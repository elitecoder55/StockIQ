namespace StockApi.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StockApi.Data;
using StockApi.Models;
using StockApi.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IEmailService _email;
    private readonly ILogger<AuthController> _logger;
    private static readonly Random _rng = new();

    public AuthController(AppDbContext db, IConfiguration config, IEmailService email, ILogger<AuthController> logger)
    {
        _db = db;
        _config = config;
        _email = email;
        _logger = logger;
    }

    // ── Step 1: Send OTP ──
    [HttpPost("send-otp")]
    public async Task<IActionResult> SendOtp([FromBody] SendOtpRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { ok = false, msg = "Email is required." });

        if (!IsValidEmail(req.Email))
            return BadRequest(new { ok = false, msg = "Invalid email format." });

        var email = req.Email.ToLower().Trim();

        // Check if email is already registered
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return BadRequest(new { ok = false, msg = "This email is already registered. Please sign in." });

        // Rate limit: don't send if an unexpired OTP exists (within last 60 seconds)
        var recentOtp = await _db.EmailOtps
            .Where(o => o.Email == email && !o.Used && o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (recentOtp != null)
        {
            var waitSeconds = (int)(recentOtp.ExpiresAt - DateTime.UtcNow).TotalSeconds;
            return BadRequest(new { ok = false, msg = $"OTP already sent. Please wait {waitSeconds}s before requesting again.", waitSeconds });
        }

        // Generate 6-digit OTP
        var code = _rng.Next(100000, 999999).ToString();

        // Invalidate older OTPs for this email
        var oldOtps = await _db.EmailOtps
            .Where(o => o.Email == email && !o.Used)
            .ToListAsync();
        foreach (var old in oldOtps) old.Used = true;

        // Save new OTP (expires in 1 minute)
        var otp = new EmailOtp
        {
            Email = email,
            Code = code,
            ExpiresAt = DateTime.UtcNow.AddMinutes(1),
            CreatedAt = DateTime.UtcNow
        };
        _db.EmailOtps.Add(otp);
        await _db.SaveChangesAsync();

        // Send email
        try
        {
            await _email.SendOtpAsync(email, code);
            _logger.LogInformation("OTP sent to {Email}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send OTP to {Email}", email);
            return StatusCode(500, new { ok = false, msg = "Failed to send email. Please try again.", details = ex.Message });
        }

        return Ok(new { ok = true, msg = "Verification code sent to your email.", expiresIn = 60 });
    }

    // ── Step 2: Verify OTP & Complete Registration ──
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Password) || string.IsNullOrWhiteSpace(req.Otp))
            return BadRequest(new { ok = false, msg = "All fields including OTP are required." });

        if (!IsValidEmail(req.Email))
            return BadRequest(new { ok = false, msg = "Invalid email format." });

        var passwordValidation = ValidatePassword(req.Password);
        if (!passwordValidation.IsValid)
            return BadRequest(new { ok = false, msg = passwordValidation.Message });

        var email = req.Email.ToLower().Trim();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return BadRequest(new { ok = false, msg = "Email already registered." });

        // Verify OTP
        var validOtp = await _db.EmailOtps
            .Where(o => o.Email == email && o.Code == req.Otp && !o.Used && o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (validOtp == null)
            return BadRequest(new { ok = false, msg = "Invalid or expired verification code. Please request a new one." });

        // Mark OTP as used
        validOtp.Used = true;

        var user = new User
        {
            Name = req.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        _logger.LogInformation("New user registered: {Email}", email);

        var token = GenerateJwt(user);

        return Ok(new
        {
            ok = true,
            token,
            user = new { user.Id, user.Name, user.Email, user.CreatedAt, alerts = new List<object>() }
        });
    }

    // ── Login ──
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { ok = false, msg = "Please fill in all fields." });

        var email = req.Email.ToLower().Trim();
        var user = await _db.Users.Include(u => u.Alerts.Where(a => a.IsActive)).FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
            return BadRequest(new { ok = false, msg = "Invalid email or password." });

        // Check if account is locked
        if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTime.UtcNow)
        {
            var remainingMinutes = (int)(user.LockedUntil.Value - DateTime.UtcNow).TotalMinutes + 1;
            return BadRequest(new { ok = false, msg = $"Account is locked. Try again in {remainingMinutes} minutes." });
        }

        // Check if account is active
        if (!user.IsActive)
            return BadRequest(new { ok = false, msg = "Account is deactivated. Please contact support." });

        // Verify password
        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts++;
            
            // Lock account after 5 failed attempts
            if (user.FailedLoginAttempts >= 5)
            {
                user.LockedUntil = DateTime.UtcNow.AddMinutes(15);
                await _db.SaveChangesAsync();
                _logger.LogWarning("Account locked due to failed login attempts: {Email}", email);
                return BadRequest(new { ok = false, msg = "Too many failed attempts. Account locked for 15 minutes." });
            }

            await _db.SaveChangesAsync();
            return BadRequest(new { ok = false, msg = "Invalid email or password." });
        }

        // Reset failed attempts on successful login
        user.FailedLoginAttempts = 0;
        user.LockedUntil = null;
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("User logged in: {Email}", email);

        var token = GenerateJwt(user);

        return Ok(new
        {
            ok = true,
            token,
            user = new
            {
                user.Id,
                user.Name,
                user.Email,
                user.CreatedAt,
                alerts = user.Alerts.Select(a => new
                {
                    id = a.Id.ToString(),
                    a.Symbol,
                    a.Name,
                    targetPrice = a.TargetPrice,
                    type = a.Type,
                    currency = a.Currency,
                    color = a.Color,
                    triggered = a.Triggered,
                    emailSent = a.EmailSent,
                    createdAt = a.CreatedAt
                })
            }
        });
    }

    // ── Forgot Password (Step 1: Request Reset) ──
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { ok = false, msg = "Email is required." });

        var email = req.Email.ToLower().Trim();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Always return success to prevent email enumeration
        if (user == null)
        {
            _logger.LogWarning("Password reset requested for non-existent email: {Email}", email);
            return Ok(new { ok = true, msg = "If the email exists, a password reset link has been sent." });
        }

        // Generate secure reset token
        var resetToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        user.PasswordResetToken = resetToken;
        user.PasswordResetExpiry = DateTime.UtcNow.AddMinutes(15);
        await _db.SaveChangesAsync();

        try
        {
            await _email.SendPasswordResetAsync(email, resetToken);
            _logger.LogInformation("Password reset email sent to {Email}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password reset email to {Email}", email);
        }

        return Ok(new { ok = true, msg = "If the email exists, a password reset link has been sent." });
    }

    // ── Reset Password (Step 2: Complete Reset) ──
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.NewPassword))
            return BadRequest(new { ok = false, msg = "Token and new password are required." });

        var passwordValidation = ValidatePassword(req.NewPassword);
        if (!passwordValidation.IsValid)
            return BadRequest(new { ok = false, msg = passwordValidation.Message });

        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.PasswordResetToken == req.Token &&
            u.PasswordResetExpiry > DateTime.UtcNow);

        if (user == null)
            return BadRequest(new { ok = false, msg = "Invalid or expired reset token." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetExpiry = null;
        user.FailedLoginAttempts = 0;
        user.LockedUntil = null;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Password reset successful for user: {Email}", user.Email);

        return Ok(new { ok = true, msg = "Password reset successful. You can now log in with your new password." });
    }

    // ── Me (get current user) ──
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.Include(u => u.Alerts.Where(a => a.IsActive)).FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized(new { ok = false, msg = "User not found." });

        return Ok(new
        {
            ok = true,
            user = new
            {
                user.Id,
                user.Name,
                user.Email,
                user.CreatedAt,
                alerts = user.Alerts.Select(a => new
                {
                    id = a.Id.ToString(),
                    a.Symbol,
                    a.Name,
                    targetPrice = a.TargetPrice,
                    type = a.Type,
                    currency = a.Currency,
                    color = a.Color,
                    triggered = a.Triggered,
                    emailSent = a.EmailSent,
                    createdAt = a.CreatedAt
                })
            }
        });
    }

    // ── Logout (optional - for token blacklist in future) ──
    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("User logged out: {UserId}", userId);
        return Ok(new { ok = true, msg = "Logged out successfully." });
    }

    private string GenerateJwt(User user)
    {
        var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? _config["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT_SECRET not configured");

        var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? _config["Jwt:Issuer"] ?? "StockIQ";
        var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? _config["Jwt:Audience"] ?? "StockIQ";
        var jwtExpiryHours = int.Parse(Environment.GetEnvironmentVariable("JWT_EXPIRY_HOURS") ?? _config["Jwt:ExpiryHours"] ?? "2");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(jwtExpiryHours),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        try
        {
            var regex = new Regex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$");
            return regex.IsMatch(email);
        }
        catch
        {
            return false;
        }
    }

    private static (bool IsValid, string Message) ValidatePassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return (false, "Password is required.");

        if (password.Length < 8)
            return (false, "Password must be at least 8 characters long.");

        if (!password.Any(char.IsUpper))
            return (false, "Password must contain at least one uppercase letter.");

        if (!password.Any(char.IsLower))
            return (false, "Password must contain at least one lowercase letter.");

        if (!password.Any(char.IsDigit))
            return (false, "Password must contain at least one number.");

        if (!password.Any(ch => !char.IsLetterOrDigit(ch)))
            return (false, "Password must contain at least one special character.");

        return (true, string.Empty);
    }
}

public record SendOtpRequest(string Email);
public record RegisterRequest(string Name, string Email, string Password, string Otp);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);

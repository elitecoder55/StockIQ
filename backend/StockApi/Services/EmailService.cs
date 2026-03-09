namespace StockApi.Services;

using System.Net;
using System.Net.Mail;

public interface IEmailService
{
    Task SendOtpAsync(string toEmail, string otp);
    Task SendEmailAsync(string toEmail, string subject, string body);
    Task SendAlertNotificationAsync(string toEmail, string userName, string symbol, string name, decimal targetPrice, decimal currentPrice, string type);
    Task SendPasswordResetAsync(string toEmail, string resetToken);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    private (string Host, int Port, string User, string Pass, string From, string FromName) GetSmtpConfig()
    {
        var host = Environment.GetEnvironmentVariable("SMTP_HOST") ?? _config["Smtp:Host"] ?? "smtp.gmail.com";
        var port = int.Parse(Environment.GetEnvironmentVariable("SMTP_PORT") ?? _config["Smtp:Port"] ?? "587");
        var user = Environment.GetEnvironmentVariable("SMTP_USER") ?? _config["Smtp:User"] ?? "";
        var pass = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? _config["Smtp:Password"] ?? "";
        var from = Environment.GetEnvironmentVariable("SMTP_FROM") ?? _config["Smtp:From"] ?? user;
        var fromName = Environment.GetEnvironmentVariable("SMTP_FROM_NAME") ?? _config["Smtp:FromName"] ?? "StockIQ";
        return (host, port, user, pass, from, fromName);
    }

    public async Task SendOtpAsync(string toEmail, string otp)
    {
        var (smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName) = GetSmtpConfig();

        if (string.IsNullOrEmpty(smtpUser) || string.IsNullOrEmpty(smtpPass))
        {
            _logger.LogWarning("SMTP not configured — OTP for {Email}: {Otp}", toEmail, otp);
            return;
        }

        var message = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = $"StockIQ — Your Verification Code: {otp}",
            IsBodyHtml = true,
            Body = $@"
<!DOCTYPE html>
<html>
<body style='margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,sans-serif;'>
  <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='max-width:480px;margin:40px auto;'>
    <tr>
      <td style='background:linear-gradient(135deg,#0f1419 0%,#1a1f2e 100%);border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.06);'>
        <div style='text-align:center;margin-bottom:24px;'>
          <span style='font-size:36px;'>📈</span>
          <h1 style='color:#fff;font-size:22px;margin:8px 0 4px;'>StockIQ</h1>
          <p style='color:rgba(255,255,255,0.4);font-size:13px;margin:0;'>Smart Market Intelligence Platform</p>
        </div>
        <div style='background:rgba(0,122,255,0.08);border:1px solid rgba(0,122,255,0.2);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;'>
          <p style='color:rgba(255,255,255,0.6);font-size:14px;margin:0 0 12px;'>Your verification code is</p>
          <div style='font-size:36px;font-weight:700;letter-spacing:12px;color:#fff;font-family:monospace;'>{otp}</div>
        </div>
        <p style='color:rgba(255,255,255,0.5);font-size:13px;text-align:center;margin:0 0 8px;'>
          ⏱️ This code expires in <strong style='color:#FF9500;'>1 minute</strong>.
        </p>
        <p style='color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0;'>
          If you didn't request this code, you can safely ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"
        };

        message.To.Add(new MailAddress(toEmail));

        using var client = new SmtpClient(smtpHost, smtpPort)
        {
            Credentials = new NetworkCredential(smtpUser, smtpPass),
            EnableSsl = true,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 10000
        };

        try
        {
            await client.SendMailAsync(message);
            _logger.LogInformation("OTP email sent to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send OTP email to {Email}", toEmail);
            throw;
        }
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        var (smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName) = GetSmtpConfig();

        if (string.IsNullOrEmpty(smtpUser) || string.IsNullOrEmpty(smtpPass))
        {
            _logger.LogWarning("SMTP not configured — Email not sent to {Email}", toEmail);
            return;
        }

        var message = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = subject,
            IsBodyHtml = true,
            Body = body
        };

        message.To.Add(new MailAddress(toEmail));

        using var client = new SmtpClient(smtpHost, smtpPort)
        {
            Credentials = new NetworkCredential(smtpUser, smtpPass),
            EnableSsl = true,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 10000
        };

        try
        {
            await client.SendMailAsync(message);
            _logger.LogInformation("Email sent to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}", toEmail);
            throw;
        }
    }

    public async Task SendAlertNotificationAsync(string toEmail, string userName, string symbol, string name, decimal targetPrice, decimal currentPrice, string type)
    {
        var subject = $"🔔 StockIQ Alert: {symbol} {(type == "above" ? "↑" : "↓")} Target Reached!";
        var body = $@"
<!DOCTYPE html>
<html>
<body style='margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,sans-serif;'>
  <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='max-width:480px;margin:40px auto;'>
    <tr>
      <td style='background:linear-gradient(135deg,#0f1419 0%,#1a1f2e 100%);border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.06);'>
        <div style='text-align:center;margin-bottom:24px;'>
          <span style='font-size:36px;'>🔔</span>
          <h1 style='color:#fff;font-size:22px;margin:8px 0 4px;'>Price Alert Triggered!</h1>
        </div>
        <div style='background:rgba(0,122,255,0.08);border:1px solid rgba(0,122,255,0.2);border-radius:12px;padding:24px;margin-bottom:24px;'>
          <h2 style='color:#fff;font-size:18px;margin:0 0 8px;'>{symbol}</h2>
          <p style='color:rgba(255,255,255,0.6);font-size:14px;margin:0 0 16px;'>{name}</p>
          <div style='display:flex;justify-content:space-between;margin-bottom:8px;'>
            <span style='color:rgba(255,255,255,0.5);font-size:13px;'>Target Price:</span>
            <span style='color:#fff;font-size:14px;font-weight:600;'>₹{targetPrice:N2}</span>
          </div>
          <div style='display:flex;justify-content:space-between;'>
            <span style='color:rgba(255,255,255,0.5);font-size:13px;'>Current Price:</span>
            <span style='color:{(type == "above" ? "#34C759" : "#FF3B30")};font-size:14px;font-weight:600;'>₹{currentPrice:N2}</span>
          </div>
        </div>
        <p style='color:rgba(255,255,255,0.5);font-size:13px;text-align:center;margin:0;'>
          Hi {userName}, your alert for {symbol} has been triggered!
        </p>
      </td>
    </tr>
  </table>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, body);
    }

    public async Task SendPasswordResetAsync(string toEmail, string resetToken)
    {
        var subject = "StockIQ — Password Reset Request";
        // Create a URL for the frontend reset password page
        // In a real app, this should come from config
        var resetUrl = $"http://localhost:5173/reset-password?token={resetToken}";
        
        var body = $@"
<!DOCTYPE html>
<html>
<body style='margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,sans-serif;'>
  <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='max-width:480px;margin:40px auto;'>
    <tr>
      <td style='background:linear-gradient(135deg,#0f1419 0%,#1a1f2e 100%);border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.06);'>
        <div style='text-align:center;margin-bottom:24px;'>
          <span style='font-size:36px;'>🔑</span>
          <h1 style='color:#fff;font-size:22px;margin:8px 0 4px;'>Password Reset Request</h1>
        </div>
        <div style='background:rgba(0,122,255,0.08);border:1px solid rgba(0,122,255,0.2);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;'>
          <p style='color:rgba(255,255,255,0.8);font-size:14px;margin:0 0 16px;line-height:1.5;'>
            We received a request to reset your password. Click the button below to choose a new password.
          </p>
          <a href='{resetUrl}' style='display:inline-block;background:#007AFF;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:12px;'>Reset Password</a>
          <p style='color:rgba(255,255,255,0.5);font-size:12px;margin:0;'>
            Or copy and paste this link in your browser:<br/>
            <span style='word-break:break-all;color:#007AFF;'>{resetUrl}</span>
          </p>
        </div>
        <p style='color:rgba(255,255,255,0.5);font-size:13px;text-align:center;margin:0 0 8px;'>
          ⏱️ This link expires in <strong style='color:#FF9500;'>15 minutes</strong>.
        </p>
        <p style='color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0;'>
          If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, body);
    }
}

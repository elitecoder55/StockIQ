namespace StockApi.Services;

using System.Text;
using System.Text.Json;

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
    private readonly HttpClient _http;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
        _http = new HttpClient();
    }

    private async Task SendViaResend(string toEmail, string subject, string htmlBody)
    {
        var apiKey = Environment.GetEnvironmentVariable("RESEND_API_KEY") ?? "";
        var fromEmail = Environment.GetEnvironmentVariable("RESEND_FROM") ?? "onboarding@resend.dev";

        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("RESEND_API_KEY not configured — Email not sent to {Email}", toEmail);
            return;
        }

        var payload = new
        {
            from = $"StockIQ <{fromEmail}>",
            to = new[] { toEmail },
            subject = subject,
            html = htmlBody
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Add("Authorization", $"Bearer {apiKey}");
        request.Content = content;

        try
        {
            _logger.LogInformation("Sending email via Resend to {Email} from {From}...", toEmail, fromEmail);
            var response = await _http.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Email sent successfully to {Email}. Response: {Response}", toEmail, responseBody);
            }
            else
            {
                _logger.LogError("Resend API error ({Status}): {Response}", response.StatusCode, responseBody);
                throw new Exception($"Resend API error: {response.StatusCode} - {responseBody}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}", toEmail);
            throw;
        }
    }

    private async Task SendViaBrevo(string toEmail, string subject, string htmlBody)
    {
        var apiKey = Environment.GetEnvironmentVariable("BREVO_API_KEY") ?? "";
        var senderEmail = Environment.GetEnvironmentVariable("BREVO_SENDER_EMAIL") ?? "stockiq@brevosend.com";
        var senderName = Environment.GetEnvironmentVariable("BREVO_SENDER_NAME") ?? "StockIQ";

        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("BREVO_API_KEY not configured — Email not sent to {Email}", toEmail);
            return;
        }

        var payload = new
        {
            sender = new { name = senderName, email = senderEmail },
            to = new[] { new { email = toEmail } },
            subject = subject,
            htmlContent = htmlBody
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        request.Headers.Add("api-key", apiKey);
        request.Content = content;

        try
        {
            _logger.LogInformation("Sending email via Brevo to {Email}...", toEmail);
            var response = await _http.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Email sent via Brevo to {Email}. Response: {Response}", toEmail, responseBody);
            }
            else
            {
                _logger.LogError("Brevo API error ({Status}): {Response}", response.StatusCode, responseBody);
                throw new Exception($"Brevo API error: {response.StatusCode} - {responseBody}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email via Brevo to {Email}", toEmail);
            throw;
        }
    }

    private async Task SendEmail(string toEmail, string subject, string htmlBody)
    {
        // Try Brevo first (no recipient restrictions), then Resend as fallback
        var brevoKey = Environment.GetEnvironmentVariable("BREVO_API_KEY") ?? "";
        var resendKey = Environment.GetEnvironmentVariable("RESEND_API_KEY") ?? "";

        if (!string.IsNullOrEmpty(brevoKey))
        {
            await SendViaBrevo(toEmail, subject, htmlBody);
        }
        else if (!string.IsNullOrEmpty(resendKey))
        {
            await SendViaResend(toEmail, subject, htmlBody);
        }
        else
        {
            _logger.LogWarning("No email provider configured (BREVO_API_KEY or RESEND_API_KEY). Email not sent to {Email}", toEmail);
        }
    }

    public async Task SendOtpAsync(string toEmail, string otp)
    {
        var body = $@"
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
</html>";

        await SendEmail(toEmail, $"StockIQ — Your Verification Code: {otp}", body);
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        await SendEmail(toEmail, subject, body);
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
          <div style='margin-bottom:8px;'>
            <span style='color:rgba(255,255,255,0.5);font-size:13px;'>Target Price: </span>
            <span style='color:#fff;font-size:14px;font-weight:600;'>₹{targetPrice:N2}</span>
          </div>
          <div>
            <span style='color:rgba(255,255,255,0.5);font-size:13px;'>Current Price: </span>
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

        await SendEmail(toEmail, subject, body);
    }

    public async Task SendPasswordResetAsync(string toEmail, string resetToken)
    {
        var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "https://stock-iq-green.vercel.app";
        var resetUrl = $"{frontendUrl}/reset-password?token={resetToken}";

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
          <a href='{resetUrl}' style='display:inline-block;background:#007AFF;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;'>Reset Password</a>
        </div>
        <p style='color:rgba(255,255,255,0.5);font-size:13px;text-align:center;margin:0 0 8px;'>
          ⏱️ This link expires in <strong style='color:#FF9500;'>15 minutes</strong>.
        </p>
        <p style='color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0;'>
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>";

        await SendEmail(toEmail, "StockIQ — Password Reset Request", body);
    }
}

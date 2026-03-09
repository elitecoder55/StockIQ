namespace StockApi.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockApi.Data;
using StockApi.Models;
using System.Security.Claims;

[ApiController]
[Route("api/alerts")]
[Authorize]
public class AlertsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<AlertsController> _logger;

    public AlertsController(AppDbContext db, ILogger<AlertsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── Get user's alerts with pagination ──
    [HttpGet]
    public async Task<IActionResult> GetAlerts([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] bool? triggered = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 50;

        var query = _db.UserAlerts
            .Where(a => a.UserId == UserId && a.IsActive);

        if (triggered.HasValue)
            query = query.Where(a => a.Triggered == triggered.Value);

        var total = await query.CountAsync();
        var alerts = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                id = a.Id.ToString(),
                a.Symbol,
                a.Name,
                targetPrice = a.TargetPrice,
                type = a.Type,
                currency = a.Currency,
                color = a.Color,
                triggered = a.Triggered,
                triggeredAt = a.TriggeredAt,
                emailSent = a.EmailSent,
                createdAt = a.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            alerts,
            pagination = new
            {
                page,
                pageSize,
                total,
                totalPages = (int)Math.Ceiling(total / (double)pageSize)
            }
        });
    }

    // ── Get single alert ──
    [HttpGet("{id}")]
    public async Task<IActionResult> GetAlert(int id)
    {
        var alert = await _db.UserAlerts
            .Where(a => a.Id == id && a.UserId == UserId && a.IsActive)
            .Select(a => new
            {
                id = a.Id.ToString(),
                a.Symbol,
                a.Name,
                targetPrice = a.TargetPrice,
                type = a.Type,
                currency = a.Currency,
                color = a.Color,
                triggered = a.Triggered,
                triggeredAt = a.TriggeredAt,
                emailSent = a.EmailSent,
                createdAt = a.CreatedAt,
                updatedAt = a.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (alert == null)
            return NotFound(new { msg = "Alert not found." });

        return Ok(alert);
    }

    // ── Create alert ──
    [HttpPost]
    public async Task<IActionResult> CreateAlert([FromBody] CreateAlertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Symbol))
            return BadRequest(new { msg = "Symbol is required." });

        if (req.TargetPrice <= 0)
            return BadRequest(new { msg = "Target price must be greater than 0." });

        if (req.Type != "above" && req.Type != "below")
            return BadRequest(new { msg = "Type must be 'above' or 'below'." });

        // Check if user already has too many alerts
        var userAlertCount = await _db.UserAlerts.CountAsync(a => a.UserId == UserId && a.IsActive);
        if (userAlertCount >= 100)
            return BadRequest(new { msg = "Maximum 100 active alerts allowed per user." });

        var alert = new UserAlert
        {
            UserId = UserId,
            Symbol = req.Symbol.ToUpper().Trim(),
            Name = req.Name?.Trim() ?? "",
            TargetPrice = req.TargetPrice,
            Type = req.Type ?? "below",
            Currency = req.Currency ?? "₹",
            Color = req.Color ?? "#007AFF",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.UserAlerts.Add(alert);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Alert created: User {UserId}, Symbol {Symbol}, Target {Target}", UserId, alert.Symbol, alert.TargetPrice);

        return Ok(new
        {
            id = alert.Id.ToString(),
            alert.Symbol,
            alert.Name,
            targetPrice = alert.TargetPrice,
            type = alert.Type,
            currency = alert.Currency,
            color = alert.Color,
            triggered = alert.Triggered,
            emailSent = alert.EmailSent,
            createdAt = alert.CreatedAt
        });
    }

    // ── Update alert ──
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAlert(int id, [FromBody] UpdateAlertRequest req)
    {
        var alert = await _db.UserAlerts.FirstOrDefaultAsync(a => a.Id == id && a.UserId == UserId && a.IsActive);
        if (alert == null)
            return NotFound(new { msg = "Alert not found." });

        if (req.TargetPrice.HasValue)
        {
            if (req.TargetPrice.Value <= 0)
                return BadRequest(new { msg = "Target price must be greater than 0." });
            alert.TargetPrice = req.TargetPrice.Value;
        }

        if (!string.IsNullOrWhiteSpace(req.Type))
        {
            if (req.Type != "above" && req.Type != "below")
                return BadRequest(new { msg = "Type must be 'above' or 'below'." });
            alert.Type = req.Type;
        }

        if (!string.IsNullOrWhiteSpace(req.Color))
            alert.Color = req.Color;

        alert.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Alert updated: {AlertId}", id);

        return Ok(new
        {
            id = alert.Id.ToString(),
            alert.Symbol,
            alert.Name,
            targetPrice = alert.TargetPrice,
            type = alert.Type,
            currency = alert.Currency,
            color = alert.Color,
            triggered = alert.Triggered,
            emailSent = alert.EmailSent,
            updatedAt = alert.UpdatedAt
        });
    }

    // ── Delete alert ──
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAlert(int id)
    {
        var alert = await _db.UserAlerts.FirstOrDefaultAsync(a => a.Id == id && a.UserId == UserId);
        if (alert == null)
            return NotFound(new { msg = "Alert not found." });

        // Soft delete
        alert.IsActive = false;
        alert.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Alert deleted: {AlertId}", id);

        return Ok(new { ok = true, msg = "Alert deleted successfully." });
    }

    // ── Bulk delete alerts ──
    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDeleteAlerts([FromBody] BulkDeleteRequest req)
    {
        if (req.AlertIds == null || !req.AlertIds.Any())
            return BadRequest(new { msg = "Alert IDs are required." });

        var alerts = await _db.UserAlerts
            .Where(a => req.AlertIds.Contains(a.Id) && a.UserId == UserId && a.IsActive)
            .ToListAsync();

        foreach (var alert in alerts)
        {
            alert.IsActive = false;
            alert.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Bulk delete: {Count} alerts deleted by user {UserId}", alerts.Count, UserId);

        return Ok(new { ok = true, msg = $"{alerts.Count} alerts deleted successfully.", count = alerts.Count });
    }

    // ── Mark alert as triggered (internal use) ──
    [HttpPatch("{id}/trigger")]
    public async Task<IActionResult> TriggerAlert(int id)
    {
        var alert = await _db.UserAlerts.FirstOrDefaultAsync(a => a.Id == id && a.UserId == UserId);
        if (alert == null)
            return NotFound(new { msg = "Alert not found." });

        alert.Triggered = true;
        alert.TriggeredAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    // ── Reset triggered alerts ──
    [HttpPost("reset-triggered")]
    public async Task<IActionResult> ResetTriggeredAlerts()
    {
        var alerts = await _db.UserAlerts
            .Where(a => a.UserId == UserId && a.Triggered && a.IsActive)
            .ToListAsync();

        foreach (var alert in alerts)
        {
            alert.Triggered = false;
            alert.TriggeredAt = null;
            alert.EmailSent = false;
            alert.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Reset {Count} triggered alerts for user {UserId}", alerts.Count, UserId);

        return Ok(new { ok = true, msg = $"{alerts.Count} alerts reset successfully.", count = alerts.Count });
    }
}

public record CreateAlertRequest(string Symbol, string? Name, decimal TargetPrice, string? Type, string? Currency, string? Color);
public record UpdateAlertRequest(decimal? TargetPrice, string? Type, string? Color);
public record BulkDeleteRequest(List<int> AlertIds);

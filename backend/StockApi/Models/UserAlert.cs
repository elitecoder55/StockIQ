namespace StockApi.Models;

using System.ComponentModel.DataAnnotations;

public class UserAlert
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    [Required, MaxLength(20)]
    public string Symbol { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public decimal TargetPrice { get; set; }

    [Required, MaxLength(10)]
    public string Type { get; set; } = "below"; // "below" (buy) or "above" (sell)

    [MaxLength(5)]
    public string Currency { get; set; } = "₹";

    [MaxLength(10)]
    public string Color { get; set; } = "#007AFF";

    public bool Triggered { get; set; } = false;
    public DateTime? TriggeredAt { get; set; }
    public bool EmailSent { get; set; } = false;
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

namespace StockApi.Models;

using System.ComponentModel.DataAnnotations;

public class EmailOtp
{
    public int Id { get; set; }

    [Required, MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(6)]
    public string Code { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public bool Used { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

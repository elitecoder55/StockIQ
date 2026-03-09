namespace StockApi.Data;

using Microsoft.EntityFrameworkCore;
using StockApi.Models;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserAlert> UserAlerts => Set<UserAlert>();
    public DbSet<EmailOtp> EmailOtps => Set<EmailOtp>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.HasIndex(u => u.PasswordResetToken);
            entity.HasMany(u => u.Alerts)
                  .WithOne(a => a.User)
                  .HasForeignKey(a => a.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserAlert>(entity =>
        {
            entity.HasIndex(a => a.UserId);
            entity.HasIndex(a => a.Symbol);
            entity.HasIndex(a => new { a.UserId, a.Triggered });
        });

        modelBuilder.Entity<EmailOtp>(entity =>
        {
            entity.HasIndex(o => o.Email);
            entity.HasIndex(o => new { o.Email, o.Used, o.ExpiresAt });
        });
    }
}

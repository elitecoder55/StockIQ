using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StockApi.Data;
using StockApi.Hubs;
using StockApi.Middleware;
using StockApi.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Load environment variables from .env file if exists
DotNetEnv.Env.Load();

// ── Email Service ──
builder.Services.AddSingleton<IEmailService, EmailService>();

// ── Database ──
var rawDbUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "";

var connStr = rawDbUrl;

// Detect database type and configure accordingly
if (!string.IsNullOrEmpty(connStr) && (connStr.StartsWith("postgres://") || connStr.StartsWith("postgresql://") || connStr.Contains("Host=")))
{
    // PostgreSQL
    if (connStr.StartsWith("postgres://") || connStr.StartsWith("postgresql://"))
    {
        try
        {
            var uri = new Uri(connStr);
            var userInfo = uri.UserInfo.Split(':');
            connStr = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={userInfo[1]};SSL Mode=Require;Trust Server Certificate=true";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error parsing DATABASE_URL: {ex.Message}");
            Console.WriteLine($"DATABASE_URL starts with: {connStr.Substring(0, Math.Min(20, connStr.Length))}...");
        }
    }
    Console.WriteLine($"Using PostgreSQL. ConnStr starts with: {connStr.Substring(0, Math.Min(30, connStr.Length))}...");
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(connStr));
}
else
{
    // SQLite for local testing
    if (string.IsNullOrEmpty(connStr)) connStr = "Data Source=stockiq.db";
    Console.WriteLine($"Using SQLite: {connStr}");
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite(connStr));
}

// ── JWT Auth ──
var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("JWT_SECRET must be set in environment variables or appsettings.json");

var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? builder.Configuration["Jwt:Issuer"] ?? "StockIQ";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? builder.Configuration["Jwt:Audience"] ?? "StockIQ";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };

        // SignalR JWT authentication
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/stockhub"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── Controllers ──
builder.Services.AddControllers();

// ── SignalR ──
builder.Services.AddSignalR();

// ── CORS ──
var corsOriginsRaw = Environment.GetEnvironmentVariable("CORS_ORIGINS")
    ?? builder.Configuration["Cors:AllowedOrigins"]
    ?? "http://localhost:5173,http://localhost:3000,http://localhost:4173";

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (corsOriginsRaw.Trim() == "*")
        {
            policy.AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
        else
        {
            var origins = corsOriginsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(o => o.Trim())
                .Where(o => !string.IsNullOrEmpty(o))
                .ToArray();
            
            // Ensure origins have https:// prefix
            origins = origins.Select(o => o.StartsWith("http") ? o : $"https://{o}").ToArray();
            
            policy.WithOrigins(origins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
    });
});

// ── Swagger/OpenAPI ── (Commented out temporarily)
// builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

// ── Background Services ──
builder.Services.AddHostedService<StockPriceService>();

// ── Logging ──
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var app = builder.Build();

// ── Auto-migrate DB ──
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        logger.LogInformation("Applying database migrations...");
        db.Database.Migrate();
        logger.LogInformation("Database migrations applied successfully");
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Migration failed, attempting to ensure database is created");
        try
        {
            db.Database.EnsureCreated();
            logger.LogInformation("Database created successfully");
        }
        catch (Exception ex2)
        {
            logger.LogError(ex2, "Failed to create database");
        }
    }
}

// ── Middleware Pipeline ──
app.UseMiddleware<GlobalErrorHandlingMiddleware>();
app.UseMiddleware<RateLimitingMiddleware>();

if (app.Environment.IsDevelopment())
{
    // Swagger temporarily disabled
    // app.UseSwagger();
    // app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<StockHub>("/stockhub");

app.MapGet("/", () => Results.Ok(new
{
    service = "StockIQ API",
    version = "1.0.0",
    status = "running",
    endpoints = new
    {
        api = "/api",
        swagger = "/swagger",
        signalr = "/stockhub",
        health = "/health"
    },
    timestamp = DateTime.UtcNow
}));

app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    timestamp = DateTime.UtcNow,
    uptime = Environment.TickCount64 / 1000
}));

app.MapGet("/debug-smtp", () => Results.Ok(new
{
    resend_api_key = string.IsNullOrEmpty(Environment.GetEnvironmentVariable("RESEND_API_KEY")) ? "NOT SET ❌" : "SET ✅",
    resend_from = Environment.GetEnvironmentVariable("RESEND_FROM") ?? "NOT SET (will use onboarding@resend.dev)",
    smtp_host = Environment.GetEnvironmentVariable("SMTP_HOST") ?? "NOT SET",
    smtp_port = Environment.GetEnvironmentVariable("SMTP_PORT") ?? "NOT SET",
    smtp_user = string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SMTP_USER")) ? "NOT SET" : "SET ✅",
    smtp_password = string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SMTP_PASSWORD")) ? "NOT SET" : "SET ✅",
    smtp_from = Environment.GetEnvironmentVariable("SMTP_FROM") ?? "NOT SET",
    database_url = string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DATABASE_URL")) ? "NOT SET" : "SET ✅",
    cors_origins = Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "NOT SET",
}));

app.Run();

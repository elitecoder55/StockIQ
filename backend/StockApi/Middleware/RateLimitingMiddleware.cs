namespace StockApi.Middleware;

using System.Collections.Concurrent;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly ConcurrentDictionary<string, ClientStats> _clients = new();

    public RateLimitingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        if (endpoint != null)
        {
            // Limit to 100 requests per minute per IP
            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var clientStats = _clients.GetOrAdd(ip, _ => new ClientStats());

            lock (clientStats)
            {
                if (DateTime.UtcNow - clientStats.WindowStart > TimeSpan.FromMinutes(1))
                {
                    clientStats.WindowStart = DateTime.UtcNow;
                    clientStats.RequestCount = 0;
                }

                clientStats.RequestCount++;

                if (clientStats.RequestCount > 100)
                {
                    context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    context.Response.ContentType = "application/json";
                    context.Response.WriteAsJsonAsync(new { ok = false, msg = "Rate limit exceeded. Try again later." });
                    return;
                }
            }
        }

        await _next(context);
    }

    private class ClientStats
    {
        public DateTime WindowStart { get; set; } = DateTime.UtcNow;
        public int RequestCount { get; set; } = 0;
    }
}

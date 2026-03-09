namespace StockApi.Hubs;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using StockApi.Models;
using System.Security.Claims;

[Authorize]
public class StockHub : Hub
{
    private readonly ILogger<StockHub> _logger;

    public StockHub(ILogger<StockHub> logger)
    {
        _logger = logger;
    }

    public async Task SubscribeToStock(string symbol)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Groups.AddToGroupAsync(Context.ConnectionId, symbol);
        await Clients.Caller.SendAsync("Subscribed", symbol);
        _logger.LogInformation("User {UserId} subscribed to {Symbol}", userId, symbol);
    }

    public async Task UnsubscribeFromStock(string symbol)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, symbol);
        _logger.LogInformation("User {UserId} unsubscribed from {Symbol}", userId, symbol);
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Caller.SendAsync("Connected", Context.ConnectionId);
        _logger.LogInformation("User {UserId} connected to SignalR hub", userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("User {UserId} disconnected from SignalR hub", userId);
        await base.OnDisconnectedAsync(exception);
    }
}

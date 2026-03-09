namespace StockApi.Services;

using Microsoft.AspNetCore.SignalR;
using StockApi.Hubs;
using StockApi.Models;

public class StockPriceService : BackgroundService
{
    private readonly IHubContext<StockHub> _hub;
    private readonly ILogger<StockPriceService> _logger;
    private readonly Dictionary<string, StockState> _stocks;
    private readonly Random _rng = new();

    public StockPriceService(IHubContext<StockHub> hub, ILogger<StockPriceService> logger)
    {
        _hub = hub;
        _logger = logger;
        _stocks = InitializeStocks();
    }

    private Dictionary<string, StockState> InitializeStocks()
    {
        var list = new (string Symbol, string Name, decimal Base)[]
        {
            // India — top stocks
            ("RELIANCE", "Reliance Industries Ltd", 2891m),
            ("TCS", "Tata Consultancy Services", 3824m),
            ("HDFCBANK", "HDFC Bank Ltd", 1654m),
            ("INFY", "Infosys Ltd", 1482m),
            ("ICICIBANK", "ICICI Bank Ltd", 1089m),
            ("SBIN", "State Bank of India", 812m),
            ("BHARTIARTL", "Bharti Airtel Ltd", 1287m),
            ("ITC", "ITC Ltd", 458m),
            ("KOTAKBANK", "Kotak Mahindra Bank", 1756m),
            ("LT", "Larsen & Toubro Ltd", 3412m),
            ("HINDUNILVR", "Hindustan Unilever Ltd", 2341m),
            ("AXISBANK", "Axis Bank Ltd", 1123m),
            ("MARUTI", "Maruti Suzuki India Ltd", 11243m),
            ("BAJFINANCE", "Bajaj Finance Ltd", 7234m),
            ("WIPRO", "Wipro Ltd", 478m),
            ("TATAMOTORS", "Tata Motors Ltd", 924m),
            ("SUNPHARMA", "Sun Pharmaceutical Ind.", 1642m),
            ("TITAN", "Titan Company Ltd", 3312m),
            ("ZOMATO", "Zomato Ltd", 234m),
            ("ADANIENT", "Adani Enterprises Ltd", 2456m),
            // US — top stocks
            ("AAPL", "Apple Inc.", 189.50m),
            ("GOOGL", "Alphabet Inc.", 175.20m),
            ("TSLA", "Tesla Inc.", 248.70m),
            ("MSFT", "Microsoft Corp.", 415.30m),
            ("AMZN", "Amazon.com Inc.", 198.10m),
            ("NVDA", "NVIDIA Corp.", 875.40m),
            ("META", "Meta Platforms Inc.", 512.60m),
            ("NFLX", "Netflix Inc.", 628.30m),
            ("AMD", "Advanced Micro Devices", 178.40m),
            ("JPM", "JPMorgan Chase & Co.", 198.40m),
        };

        return list.ToDictionary(
            s => s.Symbol,
            s => new StockState
            {
                Symbol = s.Symbol,
                Name = s.Name,
                BasePrice = s.Base,
                CurrentPrice = s.Base,
                PreviousPrice = s.Base,
                Volume = _rng.Next(100_000, 5_000_000)
            }
        );
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("StockPriceService started — broadcasting every 1.5s");

        while (!stoppingToken.IsCancellationRequested)
        {
            var updates = new List<StockPrice>();

            foreach (var kvp in _stocks)
            {
                var state = kvp.Value;
                state.PreviousPrice = state.CurrentPrice;

                // Simulate price movement
                var volatility = 0.009m;
                var drift = ((decimal)_rng.NextDouble() - 0.497m) * state.BasePrice * volatility;
                state.CurrentPrice = Math.Max(
                    state.BasePrice * 0.55m,
                    state.CurrentPrice + drift
                );
                state.CurrentPrice = Math.Round(state.CurrentPrice, 2);

                var change = state.CurrentPrice - state.PreviousPrice;
                var changePercent = state.PreviousPrice != 0
                    ? Math.Round(change / state.PreviousPrice * 100, 2)
                    : 0;

                // Simulate volume fluctuation
                state.Volume += _rng.Next(-50_000, 80_000);
                if (state.Volume < 10_000) state.Volume = _rng.Next(100_000, 500_000);

                updates.Add(new StockPrice
                {
                    Symbol = state.Symbol,
                    Name = state.Name,
                    Price = state.CurrentPrice,
                    Change = Math.Round(change, 2),
                    ChangePercent = changePercent,
                    Volume = state.Volume,
                    Timestamp = DateTime.UtcNow
                });
            }

            // Broadcast to all connected clients
            await _hub.Clients.All.SendAsync("StockUpdate", updates, stoppingToken);

            // Also broadcast to individual stock groups
            foreach (var update in updates)
            {
                await _hub.Clients.Group(update.Symbol)
                    .SendAsync("StockUpdate", new[] { update }, stoppingToken);
            }

            await Task.Delay(1500, stoppingToken);
        }

        _logger.LogInformation("StockPriceService stopped");
    }

    private class StockState
    {
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal BasePrice { get; set; }
        public decimal CurrentPrice { get; set; }
        public decimal PreviousPrice { get; set; }
        public long Volume { get; set; }
    }
}

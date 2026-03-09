import { useState, useEffect, useRef, useCallback } from "react";

const STOCKS = [
  { symbol: "AAPL", name: "Apple Inc.", base: 189.5, color: "#00ff88" },
  { symbol: "GOOGL", name: "Alphabet Inc.", base: 175.2, color: "#00cfff" },
  { symbol: "TSLA", name: "Tesla Inc.", base: 248.7, color: "#ff4d6d" },
  { symbol: "MSFT", name: "Microsoft Corp.", base: 415.3, color: "#a78bfa" },
  { symbol: "AMZN", name: "Amazon.com Inc.", base: 198.1, color: "#fbbf24" },
  { symbol: "NVDA", name: "NVIDIA Corp.", base: 875.4, color: "#fb923c" },
];

function generatePrice(base, prev) {
  const change = (Math.random() - 0.497) * base * 0.008;
  return Math.max(base * 0.7, prev + change);
}

function Sparkline({ data, color, width = 120, height = 40 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  const fillPts = `0,${height} ${pts} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`g-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#g-${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Last point dot */}
      {data.length > 0 && (() => {
        const last = data.length - 1;
        const x = width;
        const y = height - ((data[last] - min) / range) * height;
        return <circle cx={x} cy={y} r="3" fill={color} />;
      })()}
    </svg>
  );
}

function StockCard({ stock, price, prevPrice, history, isSelected, onClick }) {
  const change = price - prevPrice;
  const changePct = ((change / prevPrice) * 100).toFixed(2);
  const isUp = change >= 0;
  const flash = useRef(false);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    setFlashClass(isUp ? "flash-up" : "flash-down");
    const t = setTimeout(() => setFlashClass(""), 400);
    return () => clearTimeout(t);
  }, [price]);

  return (
    <div
      onClick={onClick}
      className={flashClass}
      style={{
        ...(isSelected
          ? {
            background: `linear-gradient(135deg, rgba(${stock.color === "#00ff88" ? "0,255,136" : stock.color === "#00cfff" ? "0,207,255" : stock.color === "#ff4d6d" ? "255,77,109" : stock.color === "#a78bfa" ? "167,139,250" : stock.color === "#fbbf24" ? "251,191,36" : "251,146,60"},0.12) 0%, rgba(10,10,20,0.95) 100%)`,
            border: `1px solid ${stock.color}55`,
            boxShadow: `0 0 24px ${stock.color}22, inset 0 1px 0 ${stock.color}33`,
          }
          : {
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }),
        borderRadius: "16px",
        padding: "20px",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ticker badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 13,
            fontWeight: 700,
            color: stock.color,
            letterSpacing: "0.08em",
            background: `${stock.color}18`,
            padding: "3px 10px",
            borderRadius: 6,
          }}>{stock.symbol}</span>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 5, fontFamily: "'DM Sans', sans-serif" }}>{stock.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 20,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.02em",
          }}>
            ${price.toFixed(2)}
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: isUp ? "#00ff88" : "#ff4d6d",
            fontFamily: "'Space Mono', monospace",
            marginTop: 2,
          }}>
            {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)} ({Math.abs(changePct)}%)
          </div>
        </div>
      </div>
      <Sparkline data={history} color={stock.color} width={200} height={44} />
    </div>
  );
}

function OrderBook({ symbol, color }) {
  const [orders, setOrders] = useState({ bids: [], asks: [] });
  useEffect(() => {
    const gen = () => {
      const base = STOCKS.find(s => s.symbol === symbol)?.base || 200;
      const bids = Array.from({ length: 6 }, (_, i) => ({
        price: (base - i * 0.15 - Math.random() * 0.1).toFixed(2),
        qty: (Math.random() * 500 + 50).toFixed(0),
      }));
      const asks = Array.from({ length: 6 }, (_, i) => ({
        price: (base + i * 0.15 + Math.random() * 0.1 + 0.05).toFixed(2),
        qty: (Math.random() * 500 + 50).toFixed(0),
      }));
      setOrders({ bids, asks });
    };
    gen();
    const t = setInterval(gen, 1800);
    return () => clearInterval(t);
  }, [symbol]);

  return (
    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 6 }}>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>PRICE</span>
        <span style={{ color: "rgba(255,255,255,0.4)", textAlign: "right" }}>SIZE</span>
      </div>
      {orders.asks.slice().reverse().map((a, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 2, position: "relative" }}>
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            width: `${Math.min(100, (a.qty / 550) * 100)}%`,
            background: "rgba(255,77,109,0.08)", borderRadius: 3,
          }} />
          <span style={{ color: "#ff4d6d", position: "relative" }}>{a.price}</span>
          <span style={{ color: "rgba(255,255,255,0.6)", textAlign: "right", position: "relative" }}>{a.qty}</span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${color}44`, margin: "6px 0", paddingTop: 4, textAlign: "center", color, fontSize: 13, fontWeight: 700 }}>
        SPREAD
      </div>
      {orders.bids.map((b, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 2, position: "relative" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${Math.min(100, (b.qty / 550) * 100)}%`,
            background: "rgba(0,255,136,0.08)", borderRadius: 3,
          }} />
          <span style={{ color: "#00ff88", position: "relative" }}>{b.price}</span>
          <span style={{ color: "rgba(255,255,255,0.6)", textAlign: "right", position: "relative" }}>{b.qty}</span>
        </div>
      ))}
    </div>
  );
}

function PriceChart({ history, color, symbol }) {
  if (!history || history.length < 2) return null;
  const W = 600, H = 200;
  const min = Math.min(...history) * 0.999;
  const max = Math.max(...history) * 1.001;
  const range = max - min;

  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return [x, y];
  });

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fillD = `${pathD} L${W},${H} L0,${H} Z`;

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    val: (min + range * (1 - t)).toFixed(2),
    y: t * H,
  }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {yLabels.map((l, i) => (
        <g key={i}>
          <line x1={0} y1={l.y} x2={W} y2={l.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={4} y={l.y - 3} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="'Space Mono',monospace">${l.val}</text>
        </g>
      ))}
      <path d={fillD} fill="url(#chartGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" filter="url(#glow)" />
    </svg>
  );
}

export default function StockDashboard() {
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(STOCKS.map(s => [s.symbol, s.base]))
  );
  const [prevPrices, setPrevPrices] = useState(() =>
    Object.fromEntries(STOCKS.map(s => [s.symbol, s.base]))
  );
  const [histories, setHistories] = useState(() =>
    Object.fromEntries(STOCKS.map(s => [s.symbol, [s.base]]))
  );
  const [selected, setSelected] = useState("AAPL");
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(false);
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    setTimeout(() => setConnected(true), 800);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      setPrevPrices(p => ({ ...p, ...prices }));
      setPrices(prev => {
        const next = {};
        STOCKS.forEach(s => {
          next[s.symbol] = generatePrice(s.base, prev[s.symbol]);
        });
        return next;
      });
      setHistories(prev => {
        const next = {};
        STOCKS.forEach(s => {
          const h = [...(prev[s.symbol] || []), prices[s.symbol]];
          next[s.symbol] = h.slice(-60);
        });
        return next;
      });
      // Random trade
      const s = STOCKS[Math.floor(Math.random() * STOCKS.length)];
      setTrades(t => [{
        symbol: s.symbol,
        price: prices[s.symbol]?.toFixed(2),
        qty: (Math.random() * 200 + 10).toFixed(0),
        side: Math.random() > 0.5 ? "BUY" : "SELL",
        time: new Date().toLocaleTimeString(),
        color: s.color,
      }, ...t].slice(0, 20));
    }, 1200);
    return () => clearInterval(interval);
  }, [prices]);

  const selStock = STOCKS.find(s => s.symbol === selected);
  const selPrice = prices[selected] || 0;
  const selPrev = prevPrices[selected] || selPrice;
  const selChange = selPrice - selPrev;
  const selChangePct = ((selChange / selPrev) * 100).toFixed(2);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #050508; }
        .flash-up { animation: flashUp 0.4s ease; }
        .flash-down { animation: flashDown 0.4s ease; }
        @keyframes flashUp { 0%,100%{} 50%{box-shadow: 0 0 30px #00ff8866 !important;} }
        @keyframes flashDown { 0%,100%{} 50%{box-shadow: 0 0 30px #ff4d6d66 !important;} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .trade-row { animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:translateX(0); } }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 20% 0%, rgba(0,255,136,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,207,255,0.04) 0%, transparent 50%), #050508",
        fontFamily: "'DM Sans', sans-serif",
        color: "#fff",
        padding: "0",
      }}>

        {/* Header */}
        <div style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #00ff88, #00cfff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700,
            }}>📈</div>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, letterSpacing: "0.05em" }}>
                MARKET<span style={{ color: "#00ff88" }}>PULSE</span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>REAL-TIME STOCK TERMINAL</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              {time.toLocaleTimeString([], { hour12: false })}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: connected ? "rgba(0,255,136,0.1)" : "rgba(255,100,100,0.1)",
              border: `1px solid ${connected ? "#00ff8844" : "#ff644444"}`,
              borderRadius: 20, padding: "4px 12px",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: connected ? "#00ff88" : "#ff6444",
                boxShadow: connected ? "0 0 8px #00ff88" : "0 0 8px #ff6444",
                animation: connected ? "pulse 2s infinite" : "none",
              }} />
              <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: connected ? "#00ff88" : "#ff6444" }}>
                {connected ? "LIVE" : "CONNECTING"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>

          {/* Stock Cards Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}>
            {STOCKS.map(stock => (
              <div key={stock.symbol} className="card-hover" style={{ transition: "transform 0.2s ease" }}>
                <StockCard
                  stock={stock}
                  price={prices[stock.symbol] || stock.base}
                  prevPrice={prevPrices[stock.symbol] || stock.base}
                  history={histories[stock.symbol] || []}
                  isSelected={selected === stock.symbol}
                  onClick={() => setSelected(stock.symbol)}
                />
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 260px", gap: 16 }}>

            {/* Chart */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20,
              padding: 24,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 22, fontWeight: 700,
                      color: selStock?.color,
                    }}>{selected}</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{selStock?.name}</span>
                  </div>
                  <div style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 36, fontWeight: 700,
                    color: "#fff",
                    marginTop: 4,
                  }}>${selPrice.toFixed(2)}</div>
                </div>
                <div style={{
                  textAlign: "right",
                  background: selChange >= 0 ? "rgba(0,255,136,0.1)" : "rgba(255,77,109,0.1)",
                  border: `1px solid ${selChange >= 0 ? "#00ff8844" : "#ff4d6d44"}`,
                  borderRadius: 12, padding: "10px 16px",
                }}>
                  <div style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 18, fontWeight: 700,
                    color: selChange >= 0 ? "#00ff88" : "#ff4d6d",
                  }}>
                    {selChange >= 0 ? "▲" : "▼"} {Math.abs(selChange).toFixed(2)}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: selChange >= 0 ? "#00ff88" : "#ff4d6d",
                    fontFamily: "'Space Mono', monospace",
                  }}>{Math.abs(selChangePct)}%</div>
                </div>
              </div>
              <PriceChart history={histories[selected]} color={selStock?.color} symbol={selected} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {["1M", "5M", "15M", "1H", "1D"].map(tf => (
                  <button key={tf} style={{
                    background: tf === "1M" ? `${selStock?.color}22` : "transparent",
                    border: `1px solid ${tf === "1M" ? selStock?.color + "55" : "rgba(255,255,255,0.1)"}`,
                    color: tf === "1M" ? selStock?.color : "rgba(255,255,255,0.4)",
                    borderRadius: 6, padding: "4px 10px",
                    fontFamily: "'Space Mono', monospace", fontSize: 10,
                    cursor: "pointer",
                  }}>{tf}</button>
                ))}
              </div>
            </div>

            {/* Order Book */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20,
              padding: 20,
            }}>
              <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: 14 }}>
                ORDER BOOK — {selected}
              </div>
              <OrderBook symbol={selected} color={selStock?.color} />
            </div>

            {/* Trade Feed */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20,
              padding: 20,
              overflow: "hidden",
            }}>
              <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: 14 }}>
                LIVE TRADES
              </div>
              <div style={{ overflow: "auto", maxHeight: 320 }}>
                {trades.map((t, i) => (
                  <div key={i} className="trade-row" style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 6,
                    alignItems: "center",
                    padding: "6px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    fontSize: 11,
                    fontFamily: "'Space Mono', monospace",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: t.color, fontWeight: 700, fontSize: 10 }}>{t.symbol}</span>
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 4,
                        background: t.side === "BUY" ? "rgba(0,255,136,0.15)" : "rgba(255,77,109,0.15)",
                        color: t.side === "BUY" ? "#00ff88" : "#ff4d6d",
                      }}>{t.side}</span>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>${t.price}</span>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>{t.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div style={{
            marginTop: 20, textAlign: "center",
            fontSize: 10, color: "rgba(255,255,255,0.15)",
            fontFamily: "'Space Mono', monospace",
            letterSpacing: "0.05em",
          }}>
            CONNECT TO .NET CORE SIGNALR HUB FOR LIVE DATA · ws://localhost:5000/stockhub
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}

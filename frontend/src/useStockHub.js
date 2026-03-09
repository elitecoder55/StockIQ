// useStockHub.js — React Hook for SignalR Connection
// Install: npm install @microsoft/signalr

import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const HUB_URL = `${API_BASE}/stockhub`;

export function useStockHub() {
  const connectionRef = useRef(null);
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets |
                   signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 1000, 3000, 5000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Real-time stock updates receive karo
    connection.on("StockUpdate", (stocks) => {
      setPrices(prev => {
        const next = { ...prev };
        stocks.forEach(s => {
          next[s.symbol] = {
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            volume: s.volume,
            timestamp: s.timestamp,
          };
        });
        return next;
      });
    });

    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(() => setConnected(true));
    connection.onclose(() => setConnected(false));

    connection.start()
      .then(() => {
        setConnected(true);
        setError(null);
        console.log("✅ SignalR connected to", HUB_URL);
      })
      .catch(err => {
        setError(err.message);
        console.error("❌ SignalR connection failed:", err);
      });

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  }, []);

  const subscribeToStock = useCallback(async (symbol) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      await connectionRef.current.invoke("SubscribeToStock", symbol);
    }
  }, []);

  return { prices, connected, error, subscribeToStock };
}

/*
 * ══════════════════════════════════════════════════
 * USAGE IN StockDashboard.jsx:
 * ══════════════════════════════════════════════════
 *
 * import { useStockHub } from "./useStockHub";
 *
 * export default function StockDashboard() {
 *   const { prices, connected } = useStockHub();
 *
 *   // prices["AAPL"] = { price: 190.23, change: 0.73, changePercent: 0.38, ... }
 *   // Replace simulated prices with real SignalR data
 * }
 */

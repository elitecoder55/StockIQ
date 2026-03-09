// ═══════════════════════════════════════════════
//  AUTH + ALERTS — Context & Utilities
//  Uses API backend when VITE_API_URL is set,
//  falls back to localStorage for demo mode
// ═══════════════════════════════════════════════
import { createContext, useContext, useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── Helper: API call with JWT ────────────────
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("sq_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API}${path}`, { ...options, headers });
    return await res.json();
  } catch {
    return null; // API not available, will use fallback
  }
}

// ─── Auth Context ─────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sq_user")) || null; } catch { return null; }
  });
  const [users, setUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sq_users")) || []; } catch { return []; }
  });
  const [apiMode, setApiMode] = useState(false);

  // On mount, try to restore session from JWT
  useEffect(() => {
    const token = localStorage.getItem("sq_token");
    if (token) {
      apiFetch("/api/auth/me").then(data => {
        if (data?.ok) {
          setUser(data.user);
          localStorage.setItem("sq_user", JSON.stringify(data.user));
          setApiMode(true);
        }
      });
    }
  }, []);

  // Send OTP to email (step 1 of signup)
  const sendOtp = useCallback(async (email) => {
    const data = await apiFetch("/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    if (data?.ok) return { ok: true, expiresIn: data.expiresIn || 60 };
    if (data?.msg) return { ok: false, msg: data.msg, waitSeconds: data.waitSeconds };
    // API not available — skip OTP in demo mode
    return { ok: true, expiresIn: 60, demo: true };
  }, []);

  const signUp = useCallback(async (name, email, password, otp) => {
    // Try API first
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, otp: otp || "" })
    });
    if (data?.ok) {
      localStorage.setItem("sq_token", data.token);
      localStorage.setItem("sq_user", JSON.stringify(data.user));
      setUser(data.user);
      setApiMode(true);
      return { ok: true };
    }
    if (data?.msg) return { ok: false, msg: data.msg };

    // Fallback to localStorage (demo mode — no OTP required)
    if (users.find(u => u.email === email)) return { ok: false, msg: "Email already registered." };
    const newUser = { id: Date.now().toString(), name, email, password, createdAt: new Date().toISOString(), alerts: [] };
    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem("sq_users", JSON.stringify(updated));
    const safe = { id: newUser.id, name, email, alerts: [], createdAt: newUser.createdAt };
    setUser(safe);
    localStorage.setItem("sq_user", JSON.stringify(safe));
    return { ok: true };
  }, [users]);

  const signIn = useCallback(async (email, password) => {
    // Try API first
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (data?.ok) {
      localStorage.setItem("sq_token", data.token);
      localStorage.setItem("sq_user", JSON.stringify(data.user));
      setUser(data.user);
      setApiMode(true);
      return { ok: true };
    }
    if (data?.msg) return { ok: false, msg: data.msg };

    // Fallback to localStorage
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) return { ok: false, msg: "Invalid email or password." };
    const safe = { id: found.id, name: found.name, email: found.email, alerts: found.alerts || [], createdAt: found.createdAt };
    setUser(safe);
    localStorage.setItem("sq_user", JSON.stringify(safe));
    return { ok: true };
  }, [users]);

  const signOut = useCallback(() => {
    setUser(null);
    setApiMode(false);
    localStorage.removeItem("sq_user");
    localStorage.removeItem("sq_token");
  }, []);

  // Forgot Password — sends reset email
  const forgotPassword = useCallback(async (email) => {
    const data = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    if (data?.ok) return { ok: true, msg: data.msg };
    if (data?.msg) return { ok: false, msg: data.msg };
    return { ok: false, msg: "Unable to connect to the server. Please try again." };
  }, []);

  // Reset Password — submit new password with token
  const resetPassword = useCallback(async (token, newPassword) => {
    const data = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword })
    });
    if (data?.ok) return { ok: true, msg: data.msg };
    if (data?.msg) return { ok: false, msg: data.msg };
    return { ok: false, msg: "Unable to connect to the server. Please try again." };
  }, []);

  const updateUserAlerts = useCallback((alerts) => {
    setUser(prev => {
      const updated = { ...prev, alerts };
      localStorage.setItem("sq_user", JSON.stringify(updated));
      if (!apiMode) {
        setUsers(prevUsers => {
          const upd = prevUsers.map(u => u.id === updated.id ? { ...u, alerts } : u);
          localStorage.setItem("sq_users", JSON.stringify(upd));
          return upd;
        });
      }
      return updated;
    });
  }, [apiMode]);

  return (
    <AuthContext.Provider value={{ user, sendOtp, signUp, signIn, signOut, forgotPassword, resetPassword, updateUserAlerts, apiMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ─── Alert Context ────────────────────────────
const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const { user, updateUserAlerts, apiMode } = useAuth();
  const [toasts, setToasts] = useState([]);
  const [triggered, setTriggered] = useState([]);

  const addAlert = useCallback(async (alert) => {
    if (!user) return;

    if (apiMode) {
      const data = await apiFetch("/api/alerts", {
        method: "POST",
        body: JSON.stringify(alert)
      });
      if (data?.id) {
        const newAlert = { ...data, triggered: false };
        const updated = [...(user.alerts || []), newAlert];
        updateUserAlerts(updated);
        pushToast({ type: "success", title: "Alert Set!", body: `Price alert for ${alert.symbol} at ${alert.currency}${alert.targetPrice}` });
        return;
      }
    }

    // Fallback
    const newAlert = { ...alert, id: Date.now().toString(), createdAt: new Date().toISOString(), triggered: false };
    const updated = [...(user.alerts || []), newAlert];
    updateUserAlerts(updated);
    pushToast({ type: "success", title: "Alert Set!", body: `Price alert for ${alert.symbol} at ${alert.currency}${alert.targetPrice}` });
  }, [user, updateUserAlerts, apiMode]);

  const removeAlert = useCallback(async (alertId) => {
    if (!user) return;

    if (apiMode) {
      await apiFetch(`/api/alerts/${alertId}`, { method: "DELETE" });
    }

    updateUserAlerts((user.alerts || []).filter(a => a.id !== alertId));
  }, [user, updateUserAlerts, apiMode]);

  const pushToast = useCallback((toast) => {
    const id = Date.now().toString() + Math.random();
    setToasts(t => [{ ...toast, id }, ...t].slice(0, 5));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  // Check alerts against live prices
  const checkAlerts = useCallback((prices) => {
    if (!user?.alerts?.length) return;
    user.alerts.forEach(async (alert) => {
      if (alert.triggered) return;
      const livePrice = prices[alert.symbol];
      if (!livePrice) return;
      let hit = false;
      let msg = "";
      if (alert.type === "below" && livePrice <= alert.targetPrice) {
        hit = true;
        msg = `🟢 BUY SIGNAL: ${alert.symbol} hit ₹${livePrice.toFixed(2)} — below your target ₹${alert.targetPrice}`;
      } else if (alert.type === "above" && livePrice >= alert.targetPrice) {
        hit = true;
        msg = `🔴 SELL SIGNAL: ${alert.symbol} hit ₹${livePrice.toFixed(2)} — above your target ₹${alert.targetPrice}`;
      }
      if (hit) {
        pushToast({ type: alert.type === "below" ? "buy" : "sell", title: alert.type === "below" ? "Buy Alert Triggered!" : "Sell Alert Triggered!", body: msg });
        if (Notification.permission === "granted") {
          new Notification(alert.type === "below" ? "📈 Buy Signal!" : "📉 Sell Signal!", { body: msg, icon: "/favicon.ico" });
        }
        setTriggered(prev => [...prev, alert.id]);

        // Mark triggered in API
        if (apiMode) {
          await apiFetch(`/api/alerts/${alert.id}/trigger`, { method: "PATCH" });
        }

        const updated = user.alerts.map(a => a.id === alert.id ? { ...a, triggered: true } : a);
        updateUserAlerts(updated);
      }
    });
  }, [user, pushToast, updateUserAlerts, apiMode]);

  const requestNotifPermission = useCallback(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <AlertContext.Provider value={{ addAlert, removeAlert, toasts, pushToast, checkAlerts, requestNotifPermission, triggered }}>
      {children}
    </AlertContext.Provider>
  );
}

export const useAlerts = () => useContext(AlertContext);

// ─── Price simulation helpers ─────────────────
export function simPrice(base, prev, vol = 0.009) {
  const d = (Math.random() - 0.497) * base * vol;
  return Math.round(Math.max(base * 0.55, prev + d) * 100) / 100;
}

export function generateHistory(base, days = 120) {
  let p = base * (0.82 + Math.random() * 0.12);
  return Array.from({ length: days }, (_, i) => {
    p = simPrice(base, p, 0.013);
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    return { price: Math.round(p * 100) / 100, date: d.toISOString().split("T")[0] };
  });
}

export function generatePrediction(history, stock) {
  const prices = history.map(h => h.price);
  const recent = prices.slice(-30), older = prices.slice(-60, -30);
  const rAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const oAvg = older.length ? older.reduce((a, b) => a + b, 0) / older.length : rAvg;
  const momentum = (rAvg - oAvg) / oAvg;
  const n = recent.length, xM = (n - 1) / 2;
  let num = 0, den = 0;
  recent.forEach((y, x) => { num += (x - xM) * (y - rAvg); den += (x - xM) ** 2; });
  const slope = den ? num / den : 0;
  const returns = prices.slice(-60).map((p, i, a) => i === 0 ? 0 : (p - a[i - 1]) / a[i - 1]);
  const vol = Math.sqrt(returns.slice(1).reduce((s, r) => s + r * r, 0) / returns.length) || 0.01;
  const cur = prices[prices.length - 1];
  const tf = 1 + momentum * 0.3;
  const rsi = Math.max(15, Math.min(85, 50 + momentum * 200));
  const sentiment = momentum > 0.02 ? "BULLISH" : momentum < -0.02 ? "BEARISH" : "NEUTRAL";
  const confidence = Math.round(Math.max(40, Math.min(92, 75 - vol * 300)));
  const w = Math.round(cur * tf * (1 + slope * 7 / cur * 0.5) * 100) / 100;
  const m = Math.round(cur * tf * (1 + slope * 30 / cur * 0.5) * 100) / 100;
  const q = Math.round(cur * tf * (1 + slope * 90 / cur * 0.5) * 100) / 100;
  return {
    sentiment, confidence, rsi: Math.round(rsi),
    momentum: Math.round(momentum * 10000) / 100,
    volatility: Math.round(vol * 10000) / 100,
    targets: { week: w, month: m, quarter: q },
    support: Math.round(Math.min(...prices.slice(-30)) * 0.98 * 100) / 100,
    resistance: Math.round(Math.max(...prices.slice(-30)) * 1.02 * 100) / 100,
    lowestExpected: Math.round(Math.min(...prices.slice(-30)) * (0.95 - vol * 5) * 100) / 100,
    bestSellZone: Math.round(Math.max(...prices.slice(-30)) * (1.02 + vol * 3) * 100) / 100,
    summary: sentiment === "BULLISH"
      ? `${stock.name} shows strong uptrend. Momentum is positive with increasing buying pressure. Consider accumulating near support levels.`
      : sentiment === "BEARISH"
        ? `${stock.name} is under bearish pressure. Strong selling momentum — wait for reversal signal before entering.`
        : `${stock.name} is consolidating. Wait for a clear breakout above resistance or breakdown below support for direction.`,
  };
}

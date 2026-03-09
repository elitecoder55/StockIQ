import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AuthProvider, AlertProvider, useAuth, useAlerts, simPrice, generateHistory, generatePrediction } from "./context.jsx";
import { STOCKS, IPOS } from "./data.js";

// ═══════════════════════════════════════════════════════════════
//  TINY SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════
function Spark({ data, up, w = 56, h = 24 }) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / r) * h}`).join(" ");
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={up ? "#30D158" : "#FF3B30"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Badge({ text, color, bg }) {
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: bg || `${color}1A`, color, fontWeight: 600, letterSpacing: "0.04em" }}>
      {text}
    </span>
  );
}

function PriceChart({ history, color, prediction, showPrediction }) {
  const W = 760, H = 190;
  const allP = history.map(h => h.price);
  const ext = showPrediction && prediction
    ? [...allP, prediction.targets.week, prediction.targets.month, prediction.targets.quarter] : allP;
  const min = Math.min(...ext) * 0.994, max = Math.max(...ext) * 1.006, range = max - min || 1;
  const toX = (i, tot) => (i / (tot - 1)) * W;
  const toY = v => H - ((v - min) / range) * H;
  const hp = allP.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i, allP.length).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const hf = `${hp} L${W},${H} L0,${H} Z`;
  const lc = allP[allP.length - 1] >= allP[0] ? color : "#FF3B30";
  const gid = `cg${color.replace("#", "")}`;
  return (
    <svg width="100%" viewBox={`0 0 ${showPrediction ? W + 125 : W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lc} stopOpacity="0.20" /><stop offset="100%" stopColor={lc} stopOpacity="0.01" />
        </linearGradient>
        <filter id="gl"><feGaussianBlur stdDeviation="1.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {[0.25, 0.5, 0.75].map((t, i) => <line key={i} x1={0} y1={t * H} x2={W} y2={t * H} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />)}
      <path d={hf} fill={`url(#${gid})`} />
      <path d={hp} fill="none" stroke={lc} strokeWidth="2" strokeLinejoin="round" filter="url(#gl)" />
      <circle cx={W} cy={toY(allP[allP.length - 1])} r="4" fill={lc} />
      {showPrediction && prediction && (() => {
        const pts2 = [[W, toY(allP[allP.length - 1])], [W + 32, toY(prediction.targets.week)], [W + 72, toY(prediction.targets.month)], [W + 112, toY(prediction.targets.quarter)]];
        const pd = pts2.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        return (<>
          <line x1={W} y1={0} x2={W} y2={H} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,3" />
          <text x={W + 4} y={10} fill="rgba(255,255,255,0.28)" fontSize="7" fontFamily="-apple-system,sans-serif">FORECAST</text>
          <path d={pd} fill="none" stroke={lc} strokeWidth="2" strokeDasharray="6,3" opacity="0.75" />
          {[{ x: W + 32, v: prediction.targets.week, l: "1W" }, { x: W + 72, v: prediction.targets.month, l: "1M" }, { x: W + 112, v: prediction.targets.quarter, l: "3M" }].map(({ x, v, l }) => (
            <g key={l}>
              <circle cx={x} cy={toY(v)} r="3" fill={lc} opacity="0.85" />
              <text x={x} y={toY(v) - 6} fill={lc} fontSize="8" textAnchor="middle" fontFamily="-apple-system,sans-serif">{v}</text>
              <text x={x} y={H + 12} fill="rgba(255,255,255,0.28)" fontSize="7" textAnchor="middle" fontFamily="-apple-system,sans-serif">{l}</text>
            </g>
          ))}
        </>);
      })()}
    </svg>
  );
}

function RSIGauge({ value, color }) {
  const r = 36, cx = 46, cy = 46;
  const rad = a => (a * Math.PI) / 180;
  const a = (value / 100) * 180 - 90;
  const nx = cx + r * Math.cos(rad(a - 90)), ny = cy + r * Math.sin(rad(a - 90));
  const gc = value < 30 ? "#30D158" : value > 70 ? "#FF3B30" : color;
  return (
    <svg width="92" height="56" viewBox="0 0 92 56">
      <path d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" strokeLinecap="round" />
      <path d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`} fill="none" stroke={gc} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(value / 100) * 113} 113`} />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="2.5" fill="white" />
      <text x={cx} y={cy + 15} textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="-apple-system,sans-serif">{value}</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AUTH SCREEN
// ═══════════════════════════════════════════════════════════════
function AuthScreen() {
  const { signIn, signUp, sendOtp, forgotPassword } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [forgotSent, setForgotSent] = useState(false);
  const [step, setStep] = useState(1); // 1 = form, 2 = otp verification
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", otp: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    setCanResend(false);
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    setError(""); setLoading(true);
    if (!form.name.trim()) { setError("Please enter your full name."); setLoading(false); return; }
    if (!form.email.includes("@")) { setError("Please enter a valid email address."); setLoading(false); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); setLoading(false); return; }

    const res = await sendOtp(form.email.toLowerCase().trim());
    if (!res.ok) { setError(res.msg); setLoading(false); return; }

    setStep(2);
    setCountdown(res.expiresIn || 60);
    setCanResend(false);
    setSuccess("Verification code sent to " + form.email);
    setLoading(false);
  };

  const handleResendOtp = async () => {
    setError(""); setLoading(true);
    const res = await sendOtp(form.email.toLowerCase().trim());
    if (!res.ok) { setError(res.msg); setLoading(false); return; }
    setCountdown(res.expiresIn || 60);
    setCanResend(false);
    setSuccess("New verification code sent!");
    setLoading(false);
    set("otp", "");
  };

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    await new Promise(r => setTimeout(r, 400));

    if (mode === "signup") {
      if (step === 1) {
        await handleSendOtp();
        return;
      }
      // Step 2: verify OTP and register
      if (form.otp.length !== 6) { setError("Please enter the 6-digit verification code."); setLoading(false); return; }
      const res = await signUp(form.name.trim(), form.email.toLowerCase().trim(), form.password, form.otp);
      if (!res.ok) { setError(res.msg); setLoading(false); return; }
      setSuccess("Account created! Welcome aboard.");
    } else {
      if (!form.email || !form.password) { setError("Please fill in all fields."); setLoading(false); return; }
      const res = await signIn(form.email.toLowerCase().trim(), form.password);
      if (!res.ok) { setError(res.msg); setLoading(false); return; }
    }
    setLoading(false);
  };

  const handleBack = () => {
    setStep(1);
    setError("");
    setSuccess("");
    set("otp", "");
    setForgotSent(false);
  };

  const handleForgotPassword = async () => {
    setError(""); setLoading(true);
    if (!form.email.includes("@")) { setError("Please enter a valid email address."); setLoading(false); return; }
    const res = await forgotPassword(form.email.toLowerCase().trim());
    if (res.ok) {
      setForgotSent(true);
      setSuccess(res.msg || "If the email exists, a password reset link has been sent.");
    } else {
      setError(res.msg);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      {/* Background glow */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,122,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp 0.5s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em" }}>StockIQ</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Smart Market Intelligence Platform</div>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "32px 28px", backdropFilter: "blur(20px)" }}>
          {/* Tab toggle — only show on step 1 and not forgot mode */}
          {step === 1 && mode !== "forgot" && (
            <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 4, marginBottom: 28 }}>
              {["signin", "signup"].map(m => (
                <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); setStep(1); set("otp", ""); setForgotSent(false); }} style={{ flex: 1, padding: "8px 0", borderRadius: 9, background: mode === m ? "rgba(255,255,255,0.12)" : "transparent", border: "none", color: mode === m ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: mode === m ? 600 : 400, cursor: "pointer", transition: "all 0.2s" }}>
                  {m === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
          )}

          {/* OTP Step Header */}
          {step === 2 && mode === "signup" && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <button onClick={handleBack} style={{ position: "relative", float: "left", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 13, padding: "4px 12px", cursor: "pointer" }}>← Back</button>
              <div style={{ clear: "both" }} />
              <div style={{ fontSize: 32, marginTop: 8, marginBottom: 8 }}>📧</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>Verify Your Email</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                Enter the 6-digit code sent to<br />
                <span style={{ color: "#007AFF", fontWeight: 500 }}>{form.email}</span>
              </div>
            </div>
          )}

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {step === 1 && mode !== "forgot" && (
              <>
                {mode === "signup" && (
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: "0.06em" }}>FULL NAME</div>
                    <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="John Doe"
                      style={inputStyle} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: "0.06em" }}>EMAIL ADDRESS</div>
                  <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@example.com" type="email"
                    style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: "0.06em" }}>PASSWORD</div>
                  <input value={form.password} onChange={e => set("password", e.target.value)} placeholder={mode === "signup" ? "Min 6 characters" : "Your password"} type="password"
                    style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                </div>
                {mode === "signin" && (
                  <div style={{ textAlign: "right", marginTop: -4 }}>
                    <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); setForgotSent(false); }} style={{ background: "none", border: "none", color: "#007AFF", fontSize: 12, cursor: "pointer", textDecoration: "none", fontWeight: 500 }}>
                      Forgot Password?
                    </button>
                  </div>
                )}
                {mode === "signup" && (
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: "0.06em" }}>CONFIRM PASSWORD</div>
                    <input value={form.confirm} onChange={e => set("confirm", e.target.value)} placeholder="Repeat password" type="password"
                      style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                  </div>
                )}
              </>
            )}

            {/* OTP Input */}
            {step === 2 && mode === "signup" && (
              <>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: "0.06em" }}>VERIFICATION CODE</div>
                  <input
                    value={form.otp}
                    onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); set("otp", v); }}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    style={{ ...inputStyle, textAlign: "center", fontSize: 28, letterSpacing: "12px", fontWeight: 700, fontFamily: "monospace", padding: "16px 14px" }}
                    onKeyDown={e => e.key === "Enter" && form.otp.length === 6 && handleSubmit()}
                  />
                </div>

                {/* Timer & Resend */}
                <div style={{ textAlign: "center", marginTop: 4 }}>
                  {countdown > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Code expires in</span>
                      <span style={{
                        fontSize: 15, fontWeight: 700, fontFamily: "monospace",
                        color: countdown <= 15 ? "#FF3B30" : countdown <= 30 ? "#FF9500" : "#30D158",
                        background: countdown <= 15 ? "rgba(255,59,48,0.12)" : "rgba(48,209,88,0.08)",
                        padding: "2px 10px", borderRadius: 6,
                        animation: countdown <= 10 ? "pulse 1s infinite" : "none"
                      }}>
                        {String(Math.floor(countdown / 60)).padStart(1, "0")}:{String(countdown % 60).padStart(2, "0")}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "#FF3B30" }}>⏱️ Code expired</div>
                  )}
                  <button
                    onClick={handleResendOtp}
                    disabled={!canResend || loading}
                    style={{
                      marginTop: 8, background: "none", border: "none",
                      color: canResend ? "#007AFF" : "rgba(255,255,255,0.2)",
                      fontSize: 13, fontWeight: 500, cursor: canResend ? "pointer" : "default",
                      textDecoration: canResend ? "underline" : "none"
                    }}
                  >
                    {canResend ? "Resend verification code" : "Resend available after timer"}
                  </button>
                </div>
              </>
            )}

            {/* Forgot Password Mode */}
            {mode === "forgot" && (
              <>
                {!forgotSent ? (
                  <>
                    <div style={{ textAlign: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
                      <div style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>Reset Password</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Enter your email to receive a reset link</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: "0.06em" }}>EMAIL ADDRESS</div>
                      <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@example.com" type="email"
                        style={inputStyle} onKeyDown={e => e.key === "Enter" && handleForgotPassword()} />
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Check Your Email</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                      If an account exists for <span style={{ color: "#007AFF", fontWeight: 500 }}>{form.email}</span>,<br />
                      we've sent a password reset link.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Error / Success */}
          {error && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,59,48,0.12)", border: "1px solid rgba(255,59,48,0.3)", borderRadius: 10, fontSize: 13, color: "#FF3B30" }}>{error}</div>}
          {success && !forgotSent && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(48,209,88,0.12)", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 10, fontSize: 13, color: "#30D158" }}>{success}</div>}

          {/* Submit */}
          {mode !== "forgot" ? (
            <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 20, padding: "14px 0", background: loading ? "rgba(0,122,255,0.5)" : "#007AFF", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer", transition: "all 0.2s", letterSpacing: "-0.01em" }}>
              {loading ? "Please wait..." : mode === "signin" ? "Sign In" : step === 1 ? "Send Verification Code" : "Verify & Create Account"}
            </button>
          ) : !forgotSent ? (
            <button onClick={handleForgotPassword} disabled={loading} style={{ width: "100%", marginTop: 20, padding: "14px 0", background: loading ? "rgba(0,122,255,0.5)" : "#007AFF", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer", transition: "all 0.2s", letterSpacing: "-0.01em" }}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          ) : null}

          {/* Back to Sign In link for forgot mode */}
          {mode === "forgot" && (
            <button onClick={() => { setMode("signin"); setError(""); setSuccess(""); setForgotSent(false); }} style={{ width: "100%", marginTop: 12, padding: "10px 0", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}>
              ← Back to Sign In
            </button>
          )}

          {mode === "signup" && step === 1 && (
            <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.5 }}>
              A verification code will be sent to your email.<br />The code expires in 1 minute.
            </div>
          )}
        </div>

        {/* Demo hint */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          Demo: create any account to explore all features
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, outline: "none", fontFamily: "-apple-system,sans-serif", boxSizing: "border-box",
};

// ═══════════════════════════════════════════════════════════════
//  ALERT PANEL
// ═══════════════════════════════════════════════════════════════
function AlertPanel({ stock, currentPrice, prediction, onClose }) {
  const { user } = useAuth();
  const { addAlert, removeAlert } = useAlerts();
  const [targetPrice, setTargetPrice] = useState("");
  const [alertType, setAlertType] = useState("below"); // below=buy | above=sell
  const sym = stock?.currency || "₹";

  const userAlerts = (user?.alerts || []).filter(a => a.symbol === stock?.symbol);

  const handleAdd = () => {
    const tp = parseFloat(targetPrice);
    if (!tp || tp <= 0) return;
    addAlert({ symbol: stock.symbol, name: stock.name, targetPrice: tp, type: alertType, currency: sym, color: stock.color });
    setTargetPrice("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 28, animation: "fadeUp 0.25s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Set Price Alert</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{stock?.symbol} · Current: {sym}{currentPrice?.toFixed(2)}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>

        {/* AI Suggestion */}
        {prediction && (
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "14px 16px", marginBottom: 18, border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", marginBottom: 10 }}>AI RECOMMENDED LEVELS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(48,209,88,0.08)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(48,209,88,0.2)", cursor: "pointer" }}
                onClick={() => { setTargetPrice(prediction.lowestExpected); setAlertType("below"); }}>
                <div style={{ fontSize: 10, color: "#30D158", marginBottom: 4 }}>🟢 BEST BUY ZONE</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#30D158" }}>{sym}{prediction.lowestExpected}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Click to use</div>
              </div>
              <div style={{ background: "rgba(255,59,48,0.08)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,59,48,0.2)", cursor: "pointer" }}
                onClick={() => { setTargetPrice(prediction.bestSellZone); setAlertType("above"); }}>
                <div style={{ fontSize: 10, color: "#FF3B30", marginBottom: 4 }}>🔴 BEST SELL ZONE</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#FF3B30" }}>{sym}{prediction.bestSellZone}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Click to use</div>
              </div>
            </div>
          </div>
        )}

        {/* Alert type toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[{ v: "below", label: "🟢 Buy Below", desc: "Alert when price drops to target" }, { v: "above", label: "🔴 Sell Above", desc: "Alert when price rises to target" }].map(({ v, label, desc }) => (
            <button key={v} onClick={() => setAlertType(v)} style={{ flex: 1, padding: "10px 8px", background: alertType === v ? (v === "below" ? "rgba(48,209,88,0.15)" : "rgba(255,59,48,0.15)") : "rgba(255,255,255,0.04)", border: `1px solid ${alertType === v ? (v === "below" ? "rgba(48,209,88,0.4)" : "rgba(255,59,48,0.4)") : "rgba(255,255,255,0.08)"}`, borderRadius: 12, color: alertType === v ? (v === "below" ? "#30D158" : "#FF3B30") : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
              {label}
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{desc}</div>
            </button>
          ))}
        </div>

        {/* Price input */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>{sym}</span>
            <input type="number" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="Enter target price"
              style={{ ...inputStyle, paddingLeft: 28 }} onKeyDown={e => e.key === "Enter" && handleAdd()} />
          </div>
          <button onClick={handleAdd} disabled={!targetPrice} style={{ padding: "0 20px", background: alertType === "below" ? "#30D158" : "#FF3B30", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 600, cursor: targetPrice ? "pointer" : "default", opacity: targetPrice ? 1 : 0.5, whiteSpace: "nowrap" }}>
            Set Alert
          </button>
        </div>

        {/* Existing alerts */}
        {userAlerts.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 10 }}>ACTIVE ALERTS FOR {stock?.symbol}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {userAlerts.map(al => (
                <div key={al.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: al.triggered ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)", borderRadius: 12, border: `1px solid ${al.triggered ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)"}`, opacity: al.triggered ? 0.5 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14 }}>{al.type === "below" ? "🟢" : "🔴"}</span>
                    <div>
                      <div style={{ fontSize: 13, color: "#fff" }}>{al.type === "below" ? "Buy below" : "Sell above"} {sym}{al.targetPrice}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{al.triggered ? "✓ Triggered" : "Active"}</div>
                    </div>
                  </div>
                  <button onClick={() => removeAlert(al.id)} style={{ background: "rgba(255,59,48,0.15)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 8, padding: "4px 10px", color: "#FF3B30", fontSize: 11, cursor: "pointer" }}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!user && <div style={{ fontSize: 13, color: "#FF9500", textAlign: "center", marginTop: 8 }}>Sign in to receive email alerts 📧</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function ToastStack() {
  const { toasts } = useAlerts();
  return (
    <div style={{ position: "fixed", top: 70, right: 16, zIndex: 300, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type === "buy" ? "rgba(48,209,88,0.15)" : t.type === "sell" ? "rgba(255,59,48,0.15)" : t.type === "success" ? "rgba(0,122,255,0.15)" : "rgba(255,255,255,0.1)", backdropFilter: "blur(20px)", border: `1px solid ${t.type === "buy" ? "rgba(48,209,88,0.4)" : t.type === "sell" ? "rgba(255,59,48,0.4)" : t.type === "success" ? "rgba(0,122,255,0.4)" : "rgba(255,255,255,0.15)"}`, borderRadius: 14, padding: "12px 16px", maxWidth: 320, animation: "slideLeft 0.3s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{t.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{t.body}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AI CHAT
// ═══════════════════════════════════════════════════════════════
function AIChat({ stock, prediction, currentPrice }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => {
    if (stock) setMessages([{ role: "ai", text: `Hello! I'm the AI analyst for ${stock.symbol} (${stock.name}).\n\nAsk me anything about this stock — price targets, risk analysis, buy/sell levels, sector outlook, or historical trends. I'm here to help you make informed decisions.` }]);
  }, [stock?.symbol]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const ask = useCallback(async () => {
    if (!input.trim() || loading) return;
    const q = input.trim(); setInput("");
    setMessages(m => [...m, { role: "user", text: q }]); setLoading(true);
    try {
      const sys = `You are an expert stock market analyst specializing in both Indian markets (NSE/BSE) and US markets. Respond in clear, professional English. Be data-driven, specific, and concise (4-5 sentences max).

Stock Data for ${stock.symbol}:
- Company: ${stock.name} | Sector: ${stock.sector} | Exchange: ${stock.exchange}
- Current Price: ${stock.currency}${currentPrice?.toFixed(2)}
- AI Sentiment: ${prediction?.sentiment} | Confidence: ${prediction?.confidence}%
- Momentum: ${prediction?.momentum}% | Volatility: ${prediction?.volatility}% | RSI: ${prediction?.rsi}
- 1-Week Target: ${stock.currency}${prediction?.targets.week}
- 1-Month Target: ${stock.currency}${prediction?.targets.month}  
- 3-Month Target: ${stock.currency}${prediction?.targets.quarter}
- Support: ${stock.currency}${prediction?.support} | Resistance: ${stock.currency}${prediction?.resistance}
- Best Buy Zone: ${stock.currency}${prediction?.lowestExpected}
- Best Sell Zone: ${stock.currency}${prediction?.bestSellZone}

Rules: Respond in English only. Use specific numbers. Always add "DYOR — this is not financial advice" for investment questions. Be helpful but honest about uncertainty.`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys,
          messages: [...messages.filter((_, i) => i > 0).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })), { role: "user", content: q }]
        }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "ai", text: data.content?.map(c => c.text).join("") || "Analysis unavailable. Please retry." }]);
    } catch { setMessages(m => [...m, { role: "ai", text: "Connection error. Please try again." }]); }
    setLoading(false);
  }, [input, loading, stock, prediction, currentPrice, messages]);

  const qs = ["What is the best buy price?", "When should I sell?", "What is the downside risk?", "Outlook for next 3 months?"];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 400 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? (stock?.color || "#007AFF") : "rgba(255,255,255,0.07)", fontSize: 13, lineHeight: 1.6, color: "#fff", whiteSpace: "pre-wrap", border: m.role === "ai" ? "1px solid rgba(255,255,255,0.07)" : "none" }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", gap: 4, padding: "6px 12px" }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: stock?.color || "#007AFF", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}</div>}
        <div ref={endRef} />
      </div>
      {messages.length <= 2 && <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>{qs.map(q => <button key={q} onClick={() => setInput(q)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${stock?.color}44`, borderRadius: 20, padding: "5px 12px", fontSize: 11, color: stock?.color || "#007AFF", cursor: "pointer" }}>{q}</button>)}</div>}
      <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="Ask about this stock..." style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: "9px 16px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "-apple-system,sans-serif" }} />
        <button onClick={ask} disabled={loading || !input.trim()} style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() ? (stock?.color || "#007AFF") : "rgba(255,255,255,0.1)", border: "none", cursor: input.trim() ? "pointer" : "default", color: "#fff", fontSize: 16, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  IPO SECTION
// ═══════════════════════════════════════════════════════════════
function IPOSection() {
  const [tab, setTab] = useState("upcoming"); // upcoming | open | listed
  const [selected, setSelected] = useState(null);
  const filtered = IPOS.filter(i => i.status === tab);

  const statusColor = { upcoming: "#FF9500", open: "#30D158", listed: "#007AFF" };
  const statusLabel = { upcoming: "Upcoming", open: "Open Now", listed: "Listed" };

  return (
    <div style={{ padding: "20px 24px 32px", animation: "fadeSlide 0.2s ease" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>IPO Center</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Track upcoming, open and recently listed IPOs on NSE/BSE</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {["upcoming", "open", "listed"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 18px", borderRadius: 9, background: tab === t ? "rgba(255,255,255,0.12)" : "transparent", border: "none", color: tab === t ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: tab === t ? 600 : 400, cursor: "pointer", transition: "all 0.18s", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor[t] }} />
            {statusLabel[t]}
            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.1)", borderRadius: 6, padding: "1px 6px" }}>{IPOS.filter(i => i.status === t).length}</span>
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {filtered.map(ipo => (
          <div key={ipo.id} onClick={() => setSelected(ipo)}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 20, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${ipo.color}44`; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
            {/* Top row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ipo.color}1A`, border: `1px solid ${ipo.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{ipo.logo}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{ipo.company}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{ipo.exchange} · {ipo.sector}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ fontSize: 10, color: s <= ipo.rating ? "#FF9500" : "rgba(255,255,255,0.15)" }}>★</span>)}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Analyst Rating</div>
              </div>
            </div>

            {/* Status specific info */}
            {(ipo.status === "upcoming" || ipo.status === "open") && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>Price Band</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ipo.color }}>₹{ipo.priceBand.low}–{ipo.priceBand.high}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>Issue Size</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ipo.issueSize}</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>
                    {ipo.status === "open" ? `Closes: ${ipo.closeDate}` : `Opens: ${ipo.openDate}`}
                  </span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {ipo.gmp > 0 && <Badge text={`GMP: ₹${ipo.gmp}`} color="#30D158" />}
                    {ipo.status === "open" && ipo.subscriptionTimes && <Badge text={`${ipo.subscriptionTimes}x subscribed`} color="#FF9500" />}
                    <Badge text={ipo.status === "open" ? "OPEN" : "UPCOMING"} color={statusColor[ipo.status]} />
                  </div>
                </div>
              </>
            )}

            {ipo.status === "listed" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Issue Price</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>₹{ipo.issuePrice}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Listing Gain</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ipo.listingGain >= 0 ? "#30D158" : "#FF3B30" }}>{ipo.listingGain >= 0 ? "+" : ""}{ipo.listingGain}%</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Current Gain</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ipo.currentGain >= 0 ? "#30D158" : "#FF3B30" }}>{ipo.currentGain >= 0 ? "+" : ""}{ipo.currentGain}%</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>Subscribed: {ipo.subscriptionTimes}x</span>
                  <Badge text="LISTED" color="#007AFF" />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* IPO Detail Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 520, background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 28, maxHeight: "85vh", overflowY: "auto", animation: "fadeUp 0.25s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${selected.color}1A`, border: `1px solid ${selected.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{selected.logo}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.company}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{selected.symbol} · {selected.sector} · {selected.exchange}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
            </div>

            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 20, padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>{selected.about}</div>

            {/* Key details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              {selected.priceBand && <KV label="Price Band" val={`₹${selected.priceBand.low} – ₹${selected.priceBand.high}`} />}
              {selected.lotSize && <KV label="Lot Size" val={`${selected.lotSize} shares`} />}
              {selected.minInvestment && <KV label="Min Investment" val={`₹${selected.minInvestment.toLocaleString()}`} />}
              {selected.issueSize && <KV label="Issue Size" val={selected.issueSize} />}
              {selected.freshIssue && <KV label="Fresh Issue" val={selected.freshIssue} />}
              {selected.ofs && <KV label="OFS" val={selected.ofs} />}
              {selected.openDate && <KV label="Open Date" val={selected.openDate} />}
              {selected.closeDate && <KV label="Close Date" val={selected.closeDate} />}
              {selected.subscriptionTimes && <KV label="Subscription" val={`${selected.subscriptionTimes}x`} color="#FF9500" />}
              {selected.gmp > 0 && <KV label="Grey Market Premium" val={`₹${selected.gmp}`} color="#30D158" />}
              {selected.issuePrice && <KV label="Issue Price" val={`₹${selected.issuePrice}`} />}
              {selected.listingGain !== undefined && <KV label="Listing Gain" val={`${selected.listingGain >= 0 ? "+" : ""}${selected.listingGain}%`} color={selected.listingGain >= 0 ? "#30D158" : "#FF3B30"} />}
              {selected.currentGain !== undefined && <KV label="Current Return" val={`${selected.currentGain >= 0 ? "+" : ""}${selected.currentGain}%`} color={selected.currentGain >= 0 ? "#30D158" : "#FF3B30"} />}
            </div>

            {/* Pros & Cons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div style={{ background: "rgba(48,209,88,0.06)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(48,209,88,0.15)" }}>
                <div style={{ fontSize: 11, color: "#30D158", fontWeight: 700, marginBottom: 8 }}>✅ PROS</div>
                {selected.pros?.map((p, i) => <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>• {p}</div>)}
              </div>
              <div style={{ background: "rgba(255,59,48,0.06)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,59,48,0.15)" }}>
                <div style={{ fontSize: 11, color: "#FF3B30", fontWeight: 700, marginBottom: 8 }}>⚠️ CONS</div>
                {selected.cons?.map((c, i) => <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>• {c}</div>)}
              </div>
            </div>

            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10 }}>
              Lead Manager: {selected.lead} &nbsp;|&nbsp; Registrar: {selected.registrar}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,165,0,0.6)", marginTop: 10, textAlign: "center" }}>⚠️ This is not financial advice. DYOR before applying for any IPO.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, val, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || "#fff" }}>{val}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SEARCH PANEL
// ═══════════════════════════════════════════════════════════════
function SearchPanel({ prices, prevPrices, liveHistory, onSelect }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [exFilter, setExFilter] = useState("All");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const sectors = useMemo(() => ["All", ...Array.from(new Set(STOCKS.map(s => s.sector))).sort()], []);
  const results = useMemo(() => STOCKS.filter(s => {
    const q = query.toLowerCase();
    const match = !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q);
    const sec = filter === "All" || s.sector === filter;
    const ex = exFilter === "All" || s.exchange === exFilter || (exFilter === "India" && s.currency === "₹") || (exFilter === "US" && s.currency === "$");
    return match && sec && ex;
  }), [query, filter, exFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "fadeSlide 0.2s ease" }}>
      <div style={{ padding: "18px 24px 10px" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.35 }}>🔍</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, symbol or sector..."
            style={{ width: "100%", padding: "12px 16px 12px 40px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "#fff", fontSize: 14, outline: "none", fontFamily: "-apple-system,sans-serif", boxSizing: "border-box" }} />
          {query && <button onClick={() => setQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer", fontSize: 12 }}>✕</button>}
        </div>
      </div>
      {/* Exchange filter */}
      <div style={{ padding: "0 24px 6px", display: "flex", gap: 6 }}>
        {["All", "India", "US"].map(ex => <button key={ex} onClick={() => setExFilter(ex)} style={{ padding: "4px 14px", borderRadius: 20, background: exFilter === ex ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)", border: `1px solid ${exFilter === ex ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)"}`, color: exFilter === ex ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontWeight: exFilter === ex ? 600 : 400 }}>{ex}</button>)}
      </div>
      {/* Sector filter */}
      <div style={{ padding: "0 24px 8px", display: "flex", gap: 5, overflowX: "auto", flexShrink: 0 }}>
        {sectors.map(sec => <button key={sec} onClick={() => setFilter(sec)} style={{ whiteSpace: "nowrap", padding: "4px 12px", borderRadius: 20, background: filter === sec ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${filter === sec ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`, color: filter === sec ? "#fff" : "rgba(255,255,255,0.38)", fontSize: 10, cursor: "pointer", fontWeight: filter === sec ? 600 : 400 }}>{sec}</button>)}
      </div>
      <div style={{ padding: "0 24px 8px", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{results.length} companies found</div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 5 }}>
        {results.map(s => {
          const p = prices[s.symbol] || s.base, pv = prevPrices[s.symbol] || p;
          const up = p >= pv, chg = ((p - pv) / pv * 100);
          const hist = liveHistory[s.symbol] || [p];
          const pred = generatePrediction([...generateHistory(s.base, 40), ...hist.map(v => ({ price: v, date: "" }))], s);
          return (
            <div key={s.symbol} onClick={() => onSelect(s.symbol)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.16s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${s.color}44`; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}1A`, border: `1px solid ${s.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.logo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{s.symbol}</span>
                  <Badge text={s.exchange} color={s.currency === "₹" ? "#FF9500" : "#007AFF"} />
                  <Badge text={pred.sentiment} color={pred.sentiment === "BULLISH" ? "#30D158" : pred.sentiment === "BEARISH" ? "#FF3B30" : "#FF9F0A"} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
              </div>
              <Spark data={hist.slice(-20)} up={up} />
              <div style={{ textAlign: "right", minWidth: 75 }}>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{s.currency}{p.toFixed(s.currency === "₹" ? 0 : 2)}</div>
                <div style={{ fontSize: 10, color: up ? "#30D158" : "#FF3B30", marginTop: 1 }}>{up ? "+" : ""}{chg.toFixed(2)}%</div>
              </div>
              <div style={{ textAlign: "right", minWidth: 70, borderLeft: "1px solid rgba(255,255,255,0.07)", paddingLeft: 12 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginBottom: 2 }}>3M Target</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: pred.targets.quarter > p ? "#30D158" : "#FF3B30" }}>{s.currency}{pred.targets.quarter.toFixed(s.currency === "₹" ? 0 : 2)}</div>
              </div>
              <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 14 }}>›</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
const SIDEBAR_STOCKS = STOCKS.slice(0, 10);

function Dashboard() {
  const { user, signOut } = useAuth();
  const { checkAlerts, requestNotifPermission } = useAlerts();
  const [view, setView] = useState("stocks"); // stocks | search | ipo
  const [selected, setSelected] = useState("RELIANCE");
  const [tab, setTab] = useState("chart");
  const [timeframe, setTF] = useState("3M");
  const [showPred, setShowPred] = useState(true);
  const [flashMap, setFlashMap] = useState({});
  const [alertOpen, setAlertOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [prices, setPrices] = useState(() => Object.fromEntries(STOCKS.map(s => [s.symbol, s.base])));
  const [prevPrices, setPrev] = useState(() => Object.fromEntries(STOCKS.map(s => [s.symbol, s.base])));
  const [histories] = useState(() => Object.fromEntries(STOCKS.map(s => [s.symbol, generateHistory(s.base, 120)])));
  const [liveHistory, setLive] = useState(() => Object.fromEntries(STOCKS.map(s => [s.symbol, [s.base]])));

  const stock = STOCKS.find(s => s.symbol === selected);
  const price = prices[selected] || stock?.base || 0;
  const prev = prevPrices[selected] || price;
  const isUp = price >= prev;
  const pct = prev ? ((price - prev) / prev * 100) : 0;
  const sym = stock?.currency || "₹";
  const fullHistory = [...(histories[selected] || []), ...(liveHistory[selected] || []).map(p => ({ price: p, date: "live" }))];
  const prediction = useMemo(() => generatePrediction(fullHistory.slice(-150), stock || STOCKS[0]), [selected, prices[selected]]);
  const tfSlice = { "1W": 7, "1M": 30, "3M": 90, "6M": 120, "1Y": 120 };
  const chartData = fullHistory.slice(-(tfSlice[timeframe] || 90));

  useEffect(() => {
    requestNotifPermission();
    const iv = setInterval(() => {
      setPrev({ ...prices });
      const next = {}, fl = {};
      STOCKS.forEach(s => { next[s.symbol] = simPrice(s.base, prices[s.symbol]); fl[s.symbol] = next[s.symbol] >= prices[s.symbol] ? "up" : "down"; });
      setPrices(next);
      setFlashMap(fl);
      setLive(p => Object.fromEntries(STOCKS.map(s => [s.symbol, [...(p[s.symbol] || []).slice(-60), next[s.symbol]]])));
      checkAlerts(next);
      setTimeout(() => setFlashMap({}), 500);
    }, 1500);
    return () => clearInterval(iv);
  }, [prices]);

  const handleSelect = (sym) => { setSelected(sym); setView("stocks"); setTab("chart"); };
  const totalAlerts = user?.alerts?.filter(a => !a.triggered)?.length || 0;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#000", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", overflow: "hidden" }}>

      {/* ── TOP NAV ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(24px)", flexShrink: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>📈</span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>StockIQ</span>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "3px" }}>
          {[{ id: "stocks", label: "📊 Dashboard" }, { id: "search", label: "🔍 Search" }, { id: "ipo", label: "🚀 IPO Center" }].map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)} style={{ padding: "6px 16px", borderRadius: 9, background: view === id ? "rgba(255,255,255,0.12)" : "transparent", border: "none", color: view === id ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: view === id ? 600 : 400, cursor: "pointer", transition: "all 0.18s" }}>{label}</button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#30D158", animation: "pulse 2s infinite" }} />LIVE
          </div>

          {/* Alert bell */}
          <button onClick={() => setAlertOpen(true)} style={{ position: "relative", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: totalAlerts > 0 ? "#FF9500" : "rgba(255,255,255,0.5)", fontSize: 14 }}>
            🔔
            {totalAlerts > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#FF3B30", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{totalAlerts}</span>}
          </button>

          {/* User menu */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowUserMenu(m => !m)} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 12px", cursor: "pointer" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #007AFF, #5856D6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{user?.name?.split(" ")[0]}</span>
            </button>
            {showUserMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "8px", minWidth: 180, zIndex: 100 }}>
                <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{user?.email}</div>
                  <div style={{ fontSize: 10, color: "#FF9500", marginTop: 3 }}>📧 Email alerts enabled</div>
                </div>
                <div style={{ padding: "4px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Active alerts: {totalAlerts}</div>
                <button onClick={() => { signOut(); setShowUserMenu(false); }} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,59,48,0.1)", border: "none", borderRadius: 10, color: "#FF3B30", fontSize: 13, cursor: "pointer", textAlign: "left", marginTop: 4 }}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width: 196, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", padding: "8px 0" }}>
          {SIDEBAR_STOCKS.map(s => {
            const p = prices[s.symbol] || s.base, pv = prevPrices[s.symbol] || p;
            const up = p >= pv, active = selected === s.symbol && view === "stocks";
            return (
              <div key={s.symbol} onClick={() => handleSelect(s.symbol)}
                className={flashMap[s.symbol] === "up" ? "fup" : flashMap[s.symbol] === "down" ? "fdn" : ""}
                style={{ padding: "10px 12px", cursor: "pointer", borderLeft: active ? `3px solid ${s.color}` : "3px solid transparent", background: active ? `linear-gradient(90deg,${s.color}12,transparent)` : "transparent", transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${s.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{s.logo}</div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: active ? "#fff" : "rgba(255,255,255,0.8)" }}>{s.symbol}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{s.exchange}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{s.currency}{p.toFixed(0)}</div>
                  <div style={{ fontSize: 9.5, color: up ? "#30D158" : "#FF3B30", marginTop: 1 }}>{up ? "+" : ""}{((p - pv) / pv * 100).toFixed(2)}%</div>
                </div>
              </div>
            );
          })}
          <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }}>
            <button onClick={() => setView("search")} style={{ width: "100%", padding: "7px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.35)", fontSize: 11, cursor: "pointer" }}>
              + {STOCKS.length - 10} more →
            </button>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>

          {view === "search" && <SearchPanel prices={prices} prevPrices={prevPrices} liveHistory={liveHistory} onSelect={handleSelect} />}
          {view === "ipo" && <IPOSection />}

          {view === "stocks" && (<>
            {/* Stock header */}
            <div style={{ padding: "20px 26px 0", animation: "fadeSlide 0.25s ease" }} key={selected}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 13, background: `${stock?.color}1A`, border: `1px solid ${stock?.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{stock?.logo}</div>
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em" }}>{stock?.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{stock?.symbol} · {stock?.sector} · {stock?.exchange}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ fontSize: 38, fontWeight: 300, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{sym}{price.toFixed(sym === "₹" ? 0 : 2)}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: isUp ? "#30D158" : "#FF3B30", background: isUp ? "rgba(48,209,88,0.1)" : "rgba(255,59,48,0.1)", padding: "3px 10px", borderRadius: 8 }}>
                      {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {/* Alert button */}
                  <button onClick={() => setAlertOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "rgba(255,159,10,0.1)", border: "1px solid rgba(255,159,10,0.3)", borderRadius: 14, color: "#FF9F0A", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    🔔 Set Alert
                  </button>
                  {/* Prediction badge */}
                  <div style={{ background: prediction.sentiment === "BULLISH" ? "rgba(48,209,88,0.08)" : prediction.sentiment === "BEARISH" ? "rgba(255,59,48,0.08)" : "rgba(255,159,10,0.08)", border: `1px solid ${prediction.sentiment === "BULLISH" ? "#30D15833" : prediction.sentiment === "BEARISH" ? "#FF3B3033" : "#FF9F0A33"}`, borderRadius: 14, padding: "10px 18px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 3 }}>AI SIGNAL</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: prediction.sentiment === "BULLISH" ? "#30D158" : prediction.sentiment === "BEARISH" ? "#FF3B30" : "#FF9F0A" }}>{prediction.sentiment}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{prediction.confidence}% confidence</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {[{ id: "chart", label: "Chart" }, { id: "ai", label: "AI Analyst" }].map(({ id, label }) => (
                  <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 20px", background: "transparent", border: "none", color: tab === id ? stock?.color : "rgba(255,255,255,0.35)", borderBottom: tab === id ? `2px solid ${stock?.color}` : "2px solid transparent", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.18s" }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Chart tab */}
            {tab === "chart" && (
              <div style={{ padding: "16px 26px 26px", animation: "fadeSlide 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["1W", "1M", "3M", "6M", "1Y"].map(tf => (
                      <button key={tf} onClick={() => setTF(tf)} style={{ padding: "4px 11px", borderRadius: 8, background: timeframe === tf ? `${stock?.color}1A` : "transparent", border: `1px solid ${timeframe === tf ? stock?.color + "44" : "rgba(255,255,255,0.08)"}`, color: timeframe === tf ? stock?.color : "rgba(255,255,255,0.32)", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>{tf}</button>
                    ))}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                    <div onClick={() => setShowPred(p => !p)} style={{ width: 32, height: 18, borderRadius: 9, background: showPred ? stock?.color : "rgba(255,255,255,0.14)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 2, left: showPred ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </div>
                    AI Forecast
                  </label>
                </div>

                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 18, padding: "16px 12px 6px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 13 }}>
                  <PriceChart history={chartData} color={stock?.color || "#007AFF"} prediction={prediction} showPrediction={showPred} />
                </div>

                {/* Buy/Sell signals */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div style={{ background: "rgba(48,209,88,0.07)", border: "1px solid rgba(48,209,88,0.2)", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, color: "#30D158", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>🟢 BEST BUY ZONE</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#30D158", fontVariantNumeric: "tabular-nums" }}>{sym}{prediction.lowestExpected}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Set an alert at this price to get notified when to buy</div>
                    <button onClick={() => setAlertOpen(true)} style={{ marginTop: 10, padding: "6px 14px", background: "rgba(48,209,88,0.15)", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 10, color: "#30D158", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🔔 Alert Me</button>
                  </div>
                  <div style={{ background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, color: "#FF3B30", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>🔴 BEST SELL ZONE</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#FF3B30", fontVariantNumeric: "tabular-nums" }}>{sym}{prediction.bestSellZone}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Set an alert at this price to get notified when to sell</div>
                    <button onClick={() => setAlertOpen(true)} style={{ marginTop: 10, padding: "6px 14px", background: "rgba(255,59,48,0.15)", border: "1px solid rgba(255,59,48,0.3)", borderRadius: 10, color: "#FF3B30", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🔔 Alert Me</button>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, marginBottom: 10 }}>
                  {[
                    { label: "1W Target", val: `${sym}${prediction.targets.week}`, c: prediction.targets.week > price ? "#30D158" : "#FF3B30" },
                    { label: "1M Target", val: `${sym}${prediction.targets.month}`, c: prediction.targets.month > price ? "#30D158" : "#FF3B30" },
                    { label: "3M Target", val: `${sym}${prediction.targets.quarter}`, c: prediction.targets.quarter > price ? "#30D158" : "#FF3B30" },
                    { label: "Confidence", val: `${prediction.confidence}%`, c: stock?.color },
                    { label: "Support", val: `${sym}${prediction.support}`, c: "#30D158" },
                    { label: "Resistance", val: `${sym}${prediction.resistance}`, c: "#FF3B30" },
                    { label: "Momentum", val: `${prediction.momentum > 0 ? "+" : ""}${prediction.momentum}%`, c: prediction.momentum > 0 ? "#30D158" : "#FF3B30" },
                    { label: "Volatility", val: `${prediction.volatility}%`, c: "rgba(255,255,255,0.55)" },
                  ].map(({ label, val, c }) => (
                    <div key={label} style={{ background: "rgba(255,255,255,0.025)", borderRadius: 12, padding: "11px 13px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: c, fontVariantNumeric: "tabular-nums" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* RSI + Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 12, padding: "13px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 12 }}>
                    <RSIGauge value={prediction.rsi} color={stock?.color || "#007AFF"} />
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>RSI (14)</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: prediction.rsi < 30 ? "#30D158" : prediction.rsi > 70 ? "#FF3B30" : "#fff" }}>
                        {prediction.rsi < 30 ? "Oversold 📈" : prediction.rsi > 70 ? "Overbought 📉" : "Neutral ➡️"}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 12, padding: "13px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>AI ANALYSIS</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.62)" }}>{prediction.summary}</div>
                  </div>
                </div>
              </div>
            )}

            {tab === "ai" && (
              <div style={{ flex: 1, minHeight: 480, animation: "fadeSlide 0.2s ease" }}>
                <AIChat stock={stock} prediction={prediction} currentPrice={price} />
              </div>
            )}
          </>)}
        </div>

        {/* ── RIGHT MINI PANEL ── */}
        <div style={{ width: 170, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)", padding: "14px 12px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", marginBottom: 12 }}>WATCHLIST</div>
          {SIDEBAR_STOCKS.map(s => {
            const p = prices[s.symbol] || s.base, pv = prevPrices[s.symbol] || p;
            const up = p >= pv;
            return (
              <div key={s.symbol} onClick={() => handleSelect(s.symbol)} style={{ marginBottom: 13, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: selected === s.symbol ? s.color : "rgba(255,255,255,0.72)" }}>{s.symbol}</span>
                  <span style={{ fontSize: 10, color: up ? "#30D158" : "#FF3B30" }}>{up ? "+" : ""}{((p - pv) / pv * 100).toFixed(2)}%</span>
                </div>
                <Spark data={(liveHistory[s.symbol] || [p]).slice(-20)} up={up} w={146} h={22} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Alert Modal */}
      {alertOpen && <AlertPanel stock={stock} currentPrice={price} prediction={prediction} onClose={() => setAlertOpen(false)} />}

      {/* Toast Notifications */}
      <ToastStack />

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideLeft{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes bounce{0%,80%,100%{transform:scale(0.55)}40%{transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes flashG{0%,100%{background:transparent}50%{background:rgba(48,209,88,0.12)}}
        @keyframes flashR{0%,100%{background:transparent}50%{background:rgba(255,59,48,0.12)}}
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
        .fup{animation:flashG 0.5s ease}
        .fdn{animation:flashR 0.5s ease}
        input::placeholder{color:rgba(255,255,255,0.2)}
        button{font-family:-apple-system,sans-serif}
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════
function AppInner() {
  const { user } = useAuth();
  return user ? <AlertProvider><Dashboard /></AlertProvider> : <AuthScreen />;
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}

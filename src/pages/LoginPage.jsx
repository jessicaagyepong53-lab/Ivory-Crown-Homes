import { useState, useEffect } from "react";
import { C } from "../constants/colors";
import { login as apiLogin, changePin as apiChangePin, getSecurityQuestion, verifySecurityAnswer } from "../api/auth.js";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["⌫", "0", "✓"],
];

const HEADERS = {
  login:   "Enter your PIN to continue",
  newpin:  "Choose a new PIN (4–8 digits)",
  confirm: "Confirm your new PIN",
};

export default function LoginPage({ onLogin, onCancel }) {
  const [mode, setMode] = useState("login"); // login | question | newpin | confirm | done
  const [entered, setEntered] = useState("");
  const [shake,   setShake]   = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  // Lockout (shared visual for both PIN attempts and security-answer attempts)
  const [lockUntil, setLockUntil]         = useState(null);   // epoch ms
  const [lockRemaining, setLockRemaining] = useState(0);      // seconds

  // Forgot-PIN flow state
  const [question,    setQuestion]    = useState("");
  const [answer,       setAnswer]      = useState("");
  const [resetToken,   setResetToken]  = useState("");
  const [newPinDraft,  setNewPinDraft] = useState("");
  const [successMsg,   setSuccessMsg]  = useState("");

  // Countdown ticker while locked out
  useEffect(() => {
    if (!lockUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockRemaining(remaining);
      if (remaining <= 0) { setLockUntil(null); setError(""); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  // Keyboard support — only while a numpad screen is showing
  useEffect(() => {
    if (mode !== "login" && mode !== "newpin" && mode !== "confirm") return;
    function handleKey(e) {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace")   press("⌫");
      else if (e.key === "Enter")       press("✓");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function applyLockFromMessage(msg) {
    const text = String(msg || "");
    const hourMatch = text.match(/(\d+)\s*hour/);
    const minMatch  = text.match(/(\d+)\s*minute/);
    const ms = hourMatch ? Number(hourMatch[1]) * 3600000
             : minMatch  ? Number(minMatch[1]) * 60000
             : 15 * 60000;
    setLockUntil(Date.now() + ms);
  }

  function press(key) {
    if (loading || lockUntil) return;
    setError("");
    if (key === "⌫") { setEntered((p) => p.slice(0, -1)); return; }
    if (key === "✓") {
      if (mode === "login")        submitLogin(entered);
      else if (mode === "newpin")  submitNewPin();
      else if (mode === "confirm") submitConfirm();
      return;
    }
    if (entered.length >= 8) return;
    setEntered((p) => p + key);
  }

  function failShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  async function submitLogin(pin) {
    if (!pin) return;
    setLoading(true);
    setError("");
    try {
      await apiLogin(pin);
      onLogin();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || "Incorrect PIN. Try again.";
      if (status === 429) applyLockFromMessage(msg);
      failShake();
      setError(msg);
      setEntered("");
    } finally {
      setLoading(false);
    }
  }

  function submitNewPin() {
    if (!/^\d{4,8}$/.test(entered)) {
      setError("PIN must be 4–8 digits.");
      failShake();
      setEntered("");
      return;
    }
    setNewPinDraft(entered);
    setEntered("");
    setError("");
    setMode("confirm");
  }

  async function submitConfirm() {
    if (entered !== newPinDraft) {
      setError("PINs do not match — let's try again.");
      failShake();
      setEntered("");
      setNewPinDraft("");
      setTimeout(() => setMode("newpin"), 500);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiChangePin(entered, resetToken);
      setSuccessMsg("✓ PIN updated successfully. You can log in with your new PIN now.");
      setMode("done");
      setEntered("");
      setNewPinDraft("");
      setResetToken("");
      setAnswer("");
      setQuestion("");
    } catch (err) {
      setError(err.response?.data?.error || "Could not update your PIN. Please try again.");
      setEntered("");
      setNewPinDraft("");
      setMode("newpin");
    } finally {
      setLoading(false);
    }
  }

  async function startForgot() {
    setError("");
    setLoading(true);
    try {
      const { question } = await getSecurityQuestion();
      setQuestion(question);
      setMode("question");
    } catch (err) {
      setError(err.response?.data?.error || "No recovery option has been set up. Ask whoever manages this system to reset your PIN.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(e) {
    e.preventDefault();
    if (!answer.trim() || loading || lockUntil) return;
    setError("");
    setLoading(true);
    try {
      const { resetToken } = await verifySecurityAnswer(answer);
      setResetToken(resetToken);
      setAnswer("");
      setMode("newpin");
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || "Incorrect answer.";
      if (status === 429) applyLockFromMessage(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function backToLogin() {
    setMode("login");
    setError("");
    setEntered("");
    setAnswer("");
    setQuestion("");
    setNewPinDraft("");
    setResetToken("");
  }

  const isNumpadMode = mode === "login" || mode === "newpin" || mode === "confirm";
  const dots = Array.from({ length: entered.length }, (_, i) => i < entered.length);
  const lockHrs  = Math.floor(lockRemaining / 3600);
  const lockMins = Math.floor((lockRemaining % 3600) / 60);
  const lockSecs = lockRemaining % 60;
  const lockDisplay = lockHrs > 0
    ? `${lockHrs}h ${String(lockMins).padStart(2, "0")}m ${String(lockSecs).padStart(2, "0")}s`
    : `${String(lockMins).padStart(2, "0")}:${String(lockSecs).padStart(2, "0")}`;

  const content = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", padding: 24 }}>

      {/* Branding */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: `linear-gradient(145deg, ${C.gold}, #b8860b)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.15)", flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17L5 9L9 13L12 6L15 13L19 9L21 17H3Z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/>
              <rect x="3" y="18" width="18" height="2.5" rx="1.25" fill="white"/>
            </svg>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", color: C.text, lineHeight: 1.1 }}>
            Ivory <span style={{ color: C.teal }}>Crown</span> <span style={{ color: C.gold }}>Homes</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2.5, textTransform: "uppercase", marginTop: 4 }}>
          Property Management System
        </div>
      </div>

      {/* Card */}
      <div
        className="login-pin-card"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: "36px 40px",
          width: "100%",
          maxWidth: 340,
          boxShadow: "0 4px 24px rgba(45,37,32,0.10)",
          animation: shake ? "shake 0.45s ease" : undefined,
        }}
      >
        {/* ── Lockout banner (shown across login / question modes) ── */}
        {lockUntil && (mode === "login" || mode === "question") ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.rose, marginBottom: 8 }}>Too many incorrect attempts</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Please wait before trying again.</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 10, marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
              {lockDisplay}
            </div>
            {mode === "question" && (
              <button onClick={backToLogin} style={{ marginTop: 14, background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", textDecoration: "underline" }}>
                Back to login
              </button>
            )}
          </div>
        ) : mode === "question" ? (
          /* ── Forgot-PIN: security question ── */
          <form onSubmit={submitAnswer}>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 6, letterSpacing: 0.4 }}>
              Security Question
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
              {question}
            </div>
            <input
              type="text"
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer"
              style={{ width: "100%", boxSizing: "border-box", background: C.deep, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", color: C.text, fontSize: 14, fontFamily: "Georgia,serif", marginBottom: 16 }}
            />
            <div style={{ minHeight: 20, textAlign: "center", marginBottom: 12 }}>
              {error && <span style={{ fontSize: 12, color: C.rose, fontWeight: 600 }}>{error}</span>}
            </div>
            <button
              type="submit"
              disabled={loading || !answer.trim()}
              style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: C.teal, color: "#fff", fontSize: 14, fontFamily: "Georgia,serif", fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading || !answer.trim() ? 0.6 : 1 }}
            >
              {loading ? "Checking..." : "Continue"}
            </button>
            <button
              type="button"
              onClick={backToLogin}
              style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", textDecoration: "underline" }}
            >
              Back to login
            </button>
          </form>
        ) : mode === "done" ? (
          /* ── Success ── */
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 14, color: C.sage, fontWeight: 600, lineHeight: 1.6, marginBottom: 22 }}>{successMsg}</div>
            <button
              onClick={backToLogin}
              style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: C.teal, color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "Georgia,serif", fontWeight: 700 }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          /* ── Numpad screens: login / newpin / confirm ── */
          <>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 24, letterSpacing: 0.4 }}>
              {HEADERS[mode]}
            </div>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 28 }}>
              {dots.map((filled, i) => (
                <div
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: filled ? C.teal : "transparent",
                    border: `2px solid ${filled ? C.teal : C.border}`,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                />
              ))}
            </div>

            <div style={{ minHeight: 20, textAlign: "center", marginBottom: 18 }}>
              {error && <span style={{ fontSize: 12, color: C.rose, fontWeight: 600 }}>{error}</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {KEYS.map((row, ri) => (
                <div key={ri} style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  {row.map((key) => {
                    const isConfirm  = key === "✓";
                    const isDelete   = key === "⌫";
                    const isDisabled = isConfirm && entered.length === 0;
                    return (
                      <button
                        key={key}
                        onClick={() => press(key)}
                        disabled={isDisabled}
                        style={{
                          width: 72,
                          height: 58,
                          borderRadius: 12,
                          border: `1px solid ${isConfirm ? C.teal + "88" : C.border}`,
                          background: isConfirm ? C.tealBg : isDelete ? C.roseBg : C.deep,
                          color:      isConfirm ? C.teal   : isDelete ? C.rose   : C.text,
                          fontSize:   isConfirm || isDelete ? 18 : 20,
                          fontWeight: 700,
                          fontFamily: "Georgia,serif",
                          cursor: isDisabled ? "default" : "pointer",
                          opacity: isDisabled ? 0.35 : 1,
                          transition: "background 0.13s, transform 0.08s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}
                        onMouseDown={(e) => { if (!isDisabled) e.currentTarget.style.transform = "scale(0.94)"; }}
                        onMouseUp={(e)   => { e.currentTarget.style.transform = "scale(1)"; }}
                        onMouseLeave={(e)=> { e.currentTarget.style.transform = "scale(1)"; }}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {mode === "login" && (
              <button
                onClick={startForgot}
                disabled={loading}
                style={{ display: "block", margin: "20px auto 0", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", textDecoration: "underline" }}
              >
                Forgot PIN?
              </button>
            )}
          </>
        )}
      </div>

      {onCancel && mode === "login" && (
        <button
          onClick={onCancel}
          style={{ marginTop: 18, background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, fontFamily: "Georgia,serif", textDecoration: "underline", letterSpacing: 0.3 }}
        >
          Cancel — go back
        </button>
      )}
      {isNumpadMode && (
        <div style={{ marginTop: 14, fontSize: 11, color: C.faint, letterSpacing: 0.5 }}>
          Keyboard supported · press Enter to confirm
        </div>
      )}

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-8px); }
          40%     { transform: translateX(8px); }
          60%     { transform: translateX(-6px); }
          80%     { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );

  // Render as full-screen overlay when triggered from within the app
  if (onCancel) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.60)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, backdropFilter: "blur(3px)" }}
        onClick={(e) => e.target === e.currentTarget && mode === "login" && onCancel()}
      >
        <div style={{ background: C.bg, borderRadius: 20, padding: 8, boxShadow: "0 12px 60px rgba(0,0,0,0.22)" }}>
          {content}
        </div>
      </div>
    );
  }

  // Full-page login (used if we ever need standalone page)
  return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{content}</div>;
}
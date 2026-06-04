import { useState, useEffect } from "react";
import { C } from "../constants/colors";
import { login as apiLogin } from "../api/auth.js";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["⌫", "0", "✓"],
];

export default function LoginPage({ onLogin, onCancel }) {
  const [entered, setEntered]   = useState("");
  const [shake,   setShake]     = useState(false);
  const [error,   setError]     = useState("");
  const [loading, setLoading]   = useState(false);

  // Keyboard support
  useEffect(() => {
    function handleKey(e) {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace")   press("⌫");
      else if (e.key === "Enter")       press("✓");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function press(key) {
    if (loading) return;
    setError("");
    if (key === "⌫") { setEntered((p) => p.slice(0, -1)); return; }
    if (key === "✓") { submit(entered); return; }
    if (entered.length >= 8) return;
    setEntered((p) => p + key);
  }

  async function submit(pin) {
    if (!pin) return;
    setLoading(true);
    setError("");
    try {
      await apiLogin(pin);
      onLogin();
    } catch (err) {
      const msg = err.response?.data?.error || "Incorrect PIN. Try again.";
      setShake(true);
      setError(msg);
      setEntered("");
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  // Show exactly as many dots as digits entered
  const dots = Array.from({ length: entered.length }, (_, i) => i < entered.length);

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

      {/* PIN card */}
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
        <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 24, letterSpacing: 0.4 }}>
          Enter your PIN to continue
        </div>

        {/* PIN dots */}
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

        {/* Error message */}
        <div style={{ minHeight: 20, textAlign: "center", marginBottom: 18 }}>
          {error && (
            <span style={{ fontSize: 12, color: C.rose, fontWeight: 600 }}>{error}</span>
          )}
        </div>

        {/* Numpad */}
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
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          style={{ marginTop: 18, background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, fontFamily: "Georgia,serif", textDecoration: "underline", letterSpacing: 0.3 }}
        >
          Cancel — go back
        </button>
      )}
      <div style={{ marginTop: 14, fontSize: 11, color: C.faint, letterSpacing: 0.5 }}>
        Keyboard supported · press Enter to confirm
      </div>

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
        onClick={(e) => e.target === e.currentTarget && onCancel()}
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

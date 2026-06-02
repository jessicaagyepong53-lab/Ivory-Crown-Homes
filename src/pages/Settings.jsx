import { useState } from "react";
import { C } from "../constants/colors";
import { changePin } from "../api/auth.js";
import { iSt, lSt, card } from "../styles/shared";
import Btn from "../components/ui/Btn";

export default function Settings() {
  const [newPin,     setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error,      setError]      = useState("");
  const [saved,      setSaved]      = useState(false);
  const [saving,     setSaving]     = useState(false);

  async function handleSave() {
    setError("");
    setSaved(false);
    if (!/^\d{4,8}$/.test(newPin)) { setError("PIN must be 4–8 digits (numbers only)."); return; }
    if (newPin !== confirmPin)      { setError("PINs do not match — please re-enter."); return; }
    setSaving(true);
    try {
      await changePin(newPin);
      setSaved(true);
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => setSaved(false), 5000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update PIN. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Settings</div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>Manage your application preferences.</p>

      {/* PIN change card */}
      <div style={{ ...card, maxWidth: 500 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
          🔑 Change Access PIN
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 6, lineHeight: 1.7 }}>
          Set a new PIN (4–8 digits). <b style={{ color: C.text }}>No current PIN is required</b> — use this page if you have forgotten your PIN.
        </p>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 22, background: C.panel, borderRadius: 8, padding: "8px 12px", display: "inline-block" }}>
          PIN is stored securely on the server (bcrypt hashed).
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          <div>
            <label style={lSt}>New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              style={iSt}
              placeholder="4–8 digits"
              value={newPin}
              onChange={(e) => { setSaved(false); setError(""); setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8)); }}
            />
          </div>
          <div>
            <label style={lSt}>Confirm New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              style={iSt}
              placeholder="Re-enter new PIN"
              value={confirmPin}
              onChange={(e) => { setSaved(false); setError(""); setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8)); }}
            />
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: C.rose, fontWeight: 600, marginBottom: 14, padding: "8px 12px", background: C.roseBg, borderRadius: 7, border: `1px solid ${C.rose}33` }}>
            {error}
          </div>
        )}
        {saved && (
          <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, marginBottom: 14, padding: "8px 12px", background: C.sageBg, borderRadius: 7, border: `1px solid ${C.sage}33` }}>
            ✓ PIN updated successfully. Use your new PIN next time you log in to edit.
          </div>
        )}

        <Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save New PIN"}</Btn>
      </div>

      {/* Info card */}
      <div style={{ ...card, maxWidth: 500, marginTop: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.lavender, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>
          ℹ How PIN Protection Works
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {[
            ["👁  View", "Anyone can browse the dashboard, properties, and all data without a PIN."],
            ["✏  Edit",  "Adding tenants, ending leases, logging maintenance, and any data change requires a PIN login."],
            ["🔒 Session", "Once logged in, edits are unlocked for the current session. Closing or refreshing the page resets this."],
            ["⚙  Reset",  "Forgotten your PIN? Set a new one right here on this Settings page — no old PIN needed."],
          ].map(([label, text]) => (
            <div key={label} style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: C.muted, minWidth: 90 }}>{label}</span>
              <span style={{ color: C.text }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

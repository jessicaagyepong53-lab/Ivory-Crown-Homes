import { useState } from "react";
import { C } from "../constants/colors";
import { iSt, lSt } from "../styles/shared";
import Btn from "./ui/Btn";

export default function RenewLeaseModal({ tenantName, currentLeaseEnd, onConfirm, onClose }) {
  const [start,     setStart]     = useState(currentLeaseEnd || "");
  const [end,       setEnd]       = useState("");
  const [depPaid,   setDepPaid]   = useState(false);
  const [depAmount, setDepAmount] = useState("");

  function submit() {
    if (!start) return;
    onConfirm({
      leaseStart:    start,
      leaseEnd:      end || undefined,
      depositPaid:   depPaid,
      depositAmount: Number(depAmount) || 0,
    });
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(3px)", fontFamily: "Georgia,serif" }}
    >
      <div style={{ background: "#fffdf9", borderRadius: 16, padding: "32px 36px", maxWidth: 420, width: "92%", boxShadow: "0 12px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8 }}>🔄 Renew Lease</div>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, marginBottom: 22 }}>
          Renewing <b style={{ color: C.text }}>{tenantName}</b>'s lease. The current lease period will be archived and documents will remain, tagged to the old period. Enter the new lease dates below.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lSt}>New Lease Start *</label>
              <input type="date" style={iSt} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label style={lSt}>New Lease End</label>
              <input type="date" style={iSt} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="renew-dep" checked={depPaid} onChange={(e) => setDepPaid(e.target.checked)} />
            <label style={{ ...lSt, marginBottom: 0 }} htmlFor="renew-dep">New Deposit Paid?</label>
          </div>

          <div>
            <label style={lSt}>New Deposit Amount (GHS)</label>
            <input type="number" min="0" style={iSt} value={depAmount} onChange={(e) => setDepAmount(e.target.value)} placeholder="e.g. 2800" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "flex-end" }}>
          <Btn small variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn small onClick={submit} disabled={!start} style={{ background: C.teal, color: "#fff" }}>Renew Lease</Btn>
        </div>
      </div>
    </div>
  );
}

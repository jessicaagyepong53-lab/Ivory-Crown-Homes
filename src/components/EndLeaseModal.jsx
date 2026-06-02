import { useState } from "react";
import { C } from "../constants/colors";
import { iSt, lSt } from "../styles/shared";
import { today } from "../utils/helpers";
import Btn from "./ui/Btn";

export default function EndLeaseModal({ tenantName, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [leaseEndDate, setLeaseEndDate] = useState(today.toISOString().slice(0, 10));

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.surface, border: `2px solid ${C.rose}55`, borderRadius: 16, padding: 28, width: "90%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.rose, marginBottom: 4 }}>End Lease</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
          You are ending the lease for <b style={{ color: C.text }}>{tenantName}</b>. They will be moved to previous tenants and their unit will become vacant.
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lSt}>Lease end date</label>
          <input type="date" style={iSt} value={leaseEndDate} onChange={(e) => setLeaseEndDate(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lSt}>Reason for ending lease *</label>
          <textarea
            style={{ ...iSt, resize: "vertical", minHeight: 80 }}
            placeholder="e.g. Lease period completed, tenant relocated, non-payment of rent, mutual agreement…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn
            variant="danger"
            onClick={() => { if (!reason.trim()) return; onConfirm(reason.trim(), leaseEndDate); }}
            style={{ opacity: reason.trim() ? 1 : 0.5 }}
          >
            ✓ End Lease
          </Btn>
        </div>
      </div>
    </div>
  );
}

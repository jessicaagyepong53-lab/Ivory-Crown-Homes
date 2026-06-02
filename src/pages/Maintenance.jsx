import { useState } from "react";
import { C } from "../constants/colors";
import { iSt, lSt, card, th, td, sGrid } from "../styles/shared";
import { fmt, fmtDate } from "../utils/formatters";
import { today } from "../utils/helpers";
import Btn from "../components/ui/Btn";
import Badge from "../components/ui/Badge";
import { MAINT_TYPES, MAINT_STATUS } from "../constants/options";

const STATUS_COLORS = {
  "Pending":     [C.amber, C.amberBg],
  "In Progress": [C.sky,   C.skyBg],
  "Completed":   [C.sage,  C.sageBg],
  "Cancelled":   [C.muted, "#f5f0eb"],
};

export default function Maintenance({ maint, blocks, allUnits, requireAuth, onUpdMaint, onSaveMaint }) {
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [newMaint, setNewMaint] = useState({ blockId: "", unitId: "", type: "General", description: "", scheduledDate: "", cost: "", contractor: "" });

  function handleSaveMaint() {
    const unit = allUnits.find((u) => String(u.uid) === String(newMaint.unitId));
    if (!unit || !newMaint.description) return;
    onSaveMaint({
      ...newMaint,
      id: Date.now(),
      label: `${unit.blockName} / ${unit.name}`,
      reportedDate: today.toISOString().slice(0, 10),
      status: "Pending",
      cost: Number(newMaint.cost) || 0,
    });
    setNewMaint({ blockId: "", unitId: "", type: "General", description: "", scheduledDate: "", cost: "", contractor: "" });
    setShowAddMaint(false);
  }

  const filteredUnits = newMaint.blockId
    ? (blocks.find((b) => String(b.bid) === String(newMaint.blockId))?.units || [])
    : allUnits;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Maintenance Tracker</div>
        <Btn onClick={() => requireAuth(() => setShowAddMaint(true))}>+ Log Request</Btn>
      </div>

      {/* Status summary cards */}
      <div style={sGrid}>
        {[["Pending", C.amber, C.amberBg], ["In Progress", C.sky, C.skyBg], ["Completed", C.sage, C.sageBg], ["Cancelled", C.muted, "#f5f0eb"]].map(([s, accent, aBg]) => {
          const cnt  = maint.filter((m) => m.status === s).length;
          const cost = maint.filter((m) => m.status === s).reduce((a, m) => a + (m.cost || 0), 0);
          return (
            <div key={s} style={{ background: C.surface, border: `1px solid ${accent}55`, borderRadius: 12, padding: "17px 21px", position: "relative", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: accent }} />
              <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: aBg, opacity: 0.6 }} />
              <div style={{ fontSize: 25, fontWeight: 700, color: accent }}>{cnt}</div>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>{s}</div>
              <div style={{ fontSize: 12, color: C.faint, marginTop: 5 }}>{fmt(cost)}</div>
            </div>
          );
        })}
      </div>

      {/* Maintenance table */}
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Location", "Type", "Description", "Reported", "Scheduled", "Contractor", "Cost", "Status", "Update"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {maint.map((m) => {
              const sc = STATUS_COLORS[m.status];
              return (
                <tr key={m.id}>
                  <td style={td}><b>{m.label}</b></td>
                  <td style={td}>{m.type}</td>
                  <td style={{ ...td, maxWidth: 150 }}>{m.description}</td>
                  <td style={td}>{fmtDate(m.reportedDate)}</td>
                  <td style={td}>{m.scheduledDate ? fmtDate(m.scheduledDate) : "—"}</td>
                  <td style={td}>{m.contractor || "—"}</td>
                  <td style={td}>{fmt(m.cost)}</td>
                  <td style={td}><Badge label={m.status} color={sc[0]} bg={sc[1]} /></td>
                  <td style={td}>
                    <select value={m.status} onChange={(e) => onUpdMaint(m.id, e.target.value)} style={{ ...iSt, width: "auto", padding: "5px 8px" }}>
                      {MAINT_STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Maintenance Modal */}
      {showAddMaint && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={(e) => e.target === e.currentTarget && setShowAddMaint(false)}
        >
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 30, width: "90%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: C.teal }}>Log Maintenance Request</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lSt}>Block</label>
                <select style={iSt} value={newMaint.blockId} onChange={(e) => setNewMaint((p) => ({ ...p, blockId: e.target.value, unitId: "" }))}>
                  <option value="">Select block...</option>
                  {blocks.map((b) => <option key={b.bid} value={b.bid}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lSt}>Unit</label>
                <select style={iSt} value={newMaint.unitId} onChange={(e) => setNewMaint((p) => ({ ...p, unitId: e.target.value }))}>
                  <option value="">Select unit...</option>
                  {filteredUnits.map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lSt}>Type</label>
                <select style={iSt} value={newMaint.type} onChange={(e) => setNewMaint((p) => ({ ...p, type: e.target.value }))}>
                  {MAINT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lSt}>Scheduled Date</label>
                <input style={iSt} type="date" value={newMaint.scheduledDate} onChange={(e) => setNewMaint((p) => ({ ...p, scheduledDate: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lSt}>Description</label>
                <textarea style={{ ...iSt, resize: "vertical", minHeight: 75 }} value={newMaint.description} onChange={(e) => setNewMaint((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Estimated Cost (GHS)</label>
                <input style={iSt} type="number" value={newMaint.cost} onChange={(e) => setNewMaint((p) => ({ ...p, cost: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Contractor</label>
                <input style={iSt} type="text" value={newMaint.contractor} onChange={(e) => setNewMaint((p) => ({ ...p, contractor: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 18, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowAddMaint(false)}>Cancel</Btn>
              <Btn onClick={handleSaveMaint}>Save Request</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

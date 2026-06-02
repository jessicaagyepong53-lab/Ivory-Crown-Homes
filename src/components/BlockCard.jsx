import { useState } from "react";
import { C } from "../constants/colors";
import { UNIT_TYPES } from "../constants/options";
import { iSt, lSt } from "../styles/shared";
import { fmt } from "../utils/formatters";
import { getLeaseStatus } from "../utils/helpers";
import Btn from "./ui/Btn";
import Badge from "./ui/Badge";
import SLabel from "./ui/SLabel";
import UnitPanel from "./UnitPanel";

export default function BlockCard({ block, requireAuth, onEndLease, onSaveTenant, onAddTenant, onAddUnit, onDeleteUnit, onDeleteBlock, onRenew }) {
  const [open, setOpen] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newU, setNewU] = useState({ name: "", type: "1-Bedroom", monthlyRent: "" });

  const occ    = block.units.filter((u) => u.tenants.some((t) => getLeaseStatus(t) === "active")).length;
  const total  = block.units.length;
  const rev    = block.units.reduce((s, u) => { const a = u.tenants.find((t) => getLeaseStatus(t) === "active"); return s + (a ? u.monthlyRent : 0); }, 0);
  const occPct = total ? Math.round((occ / total) * 100) : 0;

  function saveUnit() {
    if (!newU.name || !newU.monthlyRent) return;
    onAddUnit(block.bid, { uid: Date.now(), name: newU.name, type: newU.type, monthlyRent: Number(newU.monthlyRent), tenants: [] });
    setNewU({ name: "", type: "1-Bedroom", monthlyRent: "" });
    setShowAddUnit(false);
  }

  const accentColor = occ === total && total > 0 ? C.sage : occ === 0 ? C.coral : C.amber;
  const accentBg    = occ === total && total > 0 ? C.sageBg : occ === 0 ? C.coralBg : C.amberBg;

  return (
    <div style={{ background: C.surface, border: `2px solid ${open ? C.teal + "66" : C.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "border-color 0.2s" }}>

      {/* Block header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 22px", cursor: "pointer", background: open ? "#f8fbfa" : "#fff" }} onClick={() => setOpen((o) => !o)}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: accentBg, border: `2px solid ${accentColor}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: block.type === "standalone" ? 9 : 13, fontWeight: 700, color: accentColor, lineHeight: 1.1, textAlign: "center" }}>{block.type === "standalone" ? "UNIT" : "BLK"}</span>
          <span style={{ fontSize: 9, color: C.muted }}>{occ}/{total}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
            {block.name} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>· {total} unit{total !== 1 ? "s" : ""}</span>
          </div>
          {block.address && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>📍 {block.address}</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            <div style={{ flex: 1, height: 5, background: C.borderLight, borderRadius: 3, overflow: "hidden", maxWidth: 160 }}>
              <div style={{ width: `${occPct}%`, height: "100%", background: accentColor, borderRadius: 3, transition: "width 0.4s" }} />
            </div>
            <span style={{ fontSize: 12, color: C.muted }}>{occ} occupied · {fmt(rev)}/mo</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span className="block-occ-badge"><Badge label={`${occ}/${total} Occupied`} color={accentColor} bg={accentBg} /></span>
          <span style={{ color: C.muted, fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: "18px 22px", background: C.deep }}>
          <div className="block-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <SLabel>Rooms / Units in {block.name}</SLabel>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn small onClick={() => requireAuth(() => setShowAddUnit(true))}>+ Add Room</Btn>
              <Btn small variant="ghost" style={{ color: C.rose, borderColor: C.rose + "55" }} onClick={() => { if (window.confirm(`Delete ${block.name}? This cannot be undone.`)) onDeleteBlock(block.bid); }}>🗑 Block</Btn>
            </div>
          </div>

          {showAddUnit && (
            <div style={{ background: C.tealBg, border: `1px solid ${C.teal}44`, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <SLabel color={C.teal}>New Room / Unit</SLabel>
              <div className="add-unit-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lSt}>Name *</label>
                  <input style={iSt} placeholder={`e.g. Room ${block.name.replace(/\D/g, "")}E`} value={newU.name} onChange={(e) => setNewU((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={lSt}>Type</label>
                  <select style={iSt} value={newU.type} onChange={(e) => setNewU((p) => ({ ...p, type: e.target.value }))}>
                    {UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lSt}>Monthly Rent (GHS) *</label>
                  <input type="number" style={iSt} placeholder="e.g. 2000" value={newU.monthlyRent} onChange={(e) => setNewU((p) => ({ ...p, monthlyRent: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 10, justifyContent: "flex-end" }}>
                <Btn small variant="ghost" onClick={() => setShowAddUnit(false)}>Cancel</Btn>
                <Btn small onClick={saveUnit}>Save Room</Btn>
              </div>
            </div>
          )}

          {block.units.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted, paddingBottom: 8 }}>No units yet — add one above.</div>
          ) : (
            block.units.map((u) => (
              <UnitPanel
                key={u.uid}
                unit={u}
                requireAuth={requireAuth}
                onEndLease={onEndLease}
                onSaveTenant={onSaveTenant}
                onAddTenant={onAddTenant}
                onDeleteUnit={onDeleteUnit}
                onRenew={onRenew}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

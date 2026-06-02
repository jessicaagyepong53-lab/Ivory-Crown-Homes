import { useState } from "react";
import { C } from "../constants/colors";
import { UNIT_TYPES } from "../constants/options";
import { iSt, lSt } from "../styles/shared";
import { fmt, fmtDate } from "../utils/formatters";
import { daysUntil, getReminderStatus } from "../utils/helpers";
import Btn from "./ui/Btn";
import Badge from "./ui/Badge";
import SLabel from "./ui/SLabel";
import Divider from "./ui/Divider";
import TenantRow from "./TenantRow";

const emptyNewT = {
  name: "", phone: "", email: "", leaseStart: "", leaseEnd: "",
  idType: "Ghana Card", idNumber: "", occupation: "", employer: "",
  dob: "", emergencyName: "", emergencyPhone: "", emergencyRelation: "",
  vehicles: "", notes: "", depositPaid: false, depositAmount: "", documents: [],
};

export default function UnitPanel({ unit, requireAuth, onEndLease, onSaveTenant, onAddTenant, onDeleteUnit }) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newT, setNewT] = useState(emptyNewT);

  const active = unit.tenants.filter((t) => t.leaseStatus === "active").slice(-1)[0];
  const past   = unit.tenants.filter((t) => t.leaseStatus !== "active");
  const rs     = active ? getReminderStatus(active.leaseEnd) : null;

  function saveNew() {
    if (!newT.name || !newT.leaseStart) return;
    onAddTenant(unit.uid, { ...newT, tid: `t${unit.uid}-${Date.now()}`, leaseStatus: "active", cancelReason: "", cancelDate: "", moveInDate: newT.leaseStart, depositAmount: Number(newT.depositAmount) || 0 });
    setNewT(emptyNewT);
    setShowAdd(false);
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${active ? C.teal + "44" : C.coral + "44"}`, borderRadius: 10, marginBottom: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

      {/* Unit header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: active ? "#fafffe" : "#fff9f7" }} onClick={() => setOpen((o) => !o)}>
        <div style={{ width: 42, height: 42, borderRadius: 8, background: active ? C.sageBg : C.coralBg, border: `2px solid ${active ? C.sage + "55" : C.coral + "55"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: active ? C.sage : C.coral, lineHeight: 1.1, textAlign: "center" }}>{unit.name.split(" ").slice(-1)[0]}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
            {unit.name} <span style={{ fontSize: 11, color: C.muted }}>· {unit.type} · {fmt(unit.monthlyRent)}/mo</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {active
              ? <><span style={{ color: C.sage, fontWeight: 600 }}>● {active.name}</span>{past.length > 0 && <span style={{ color: C.faint, marginLeft: 8 }}>+{past.length} previous</span>}</>
              : <span style={{ color: C.coral, fontWeight: 600 }}>● Vacant</span>
            }
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexShrink: 0 }}>
          {active && rs && <Badge label={rs.label} color={rs.color} bg={rs.bg} />}
          <Badge label={active ? "Occupied" : "Vacant"} color={active ? C.sage : C.coral} bg={active ? C.sageBg : C.coralBg} />
          <span style={{ color: C.muted, fontSize: 15, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: "16px 18px", background: C.deep }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SLabel>{active ? "Current Tenant" : "No Active Tenant"}</SLabel>
            <div style={{ display: "flex", gap: 7 }}>
              {!active && !showAdd && <Btn small onClick={() => requireAuth(() => setShowAdd(true))}>+ Add Tenant</Btn>}
              <Btn small variant="ghost" style={{ color: C.rose, borderColor: C.rose + "55" }} onClick={() => { if (window.confirm(`Delete ${unit.name}? This cannot be undone.`)) onDeleteUnit(unit.uid); }}>🗑</Btn>
            </div>
          </div>

          {active ? (
            <TenantRow
              t={active}
              isCurrent
              requireAuth={requireAuth}
              onEndLease={(tid, reason, endDate) => onEndLease(unit.uid, tid, reason, endDate)}
              onSave={(u) => onSaveTenant(unit.uid, u)}
            />
          ) : (
            <div style={{ fontSize: 13, color: C.muted, paddingBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🏠</span> Unit is currently vacant.
            </div>
          )}

          {/* Add tenant form */}
          {showAdd && (
            <div style={{ background: C.sageBg, border: `1px solid ${C.sage}44`, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <SLabel color={C.sage}>New Tenant</SLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { l: "Full Name *",      k: "name"             },
                  { l: "Phone",            k: "phone"            },
                  { l: "Email",            k: "email",  t: "email" },
                  { l: "Lease Start *",    k: "leaseStart", t: "date" },
                  { l: "Lease End",        k: "leaseEnd",   t: "date" },
                  { l: "Date of Birth",    k: "dob",        t: "date" },
                  { l: "Occupation",       k: "occupation"       },
                  { l: "Employer",         k: "employer"         },
                  { l: "ID Type",          k: "idType"           },
                  { l: "ID Number",        k: "idNumber"         },
                  { l: "Emergency Name",   k: "emergencyName"    },
                  { l: "Emergency Phone",  k: "emergencyPhone"   },
                  { l: "Relationship",     k: "emergencyRelation"},
                  { l: "Vehicles",         k: "vehicles"         },
                ].map((f) => (
                  <div key={f.k}>
                    <label style={lSt}>{f.l}</label>
                    <input type={f.t || "text"} style={iSt} value={newT[f.k] || ""} onChange={(e) => setNewT((p) => ({ ...p, [f.k]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lSt}>Notes</label>
                  <textarea style={{ ...iSt, resize: "vertical", minHeight: 55 }} value={newT.notes || ""} onChange={(e) => setNewT((p) => ({ ...p, notes: e.target.value }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, gridColumn: "1/-1" }}>
                  <input type="checkbox" id={`dep-${unit.uid}`} checked={newT.depositPaid} onChange={(e) => setNewT((p) => ({ ...p, depositPaid: e.target.checked }))} />
                  <label style={{ ...lSt, marginBottom: 0 }} htmlFor={`dep-${unit.uid}`}>Deposit Paid?</label>
                </div>
                <div>
                  <label style={lSt}>Deposit Amount (GHS)</label>
                  <input type="number" min="0" style={iSt} placeholder="e.g. 2800" value={newT.depositAmount} onChange={(e) => setNewT((p) => ({ ...p, depositAmount: e.target.value }))} />
                </div>
                <div>
                  <label style={lSt}>Deposit Amount (GHS)</label>
                  <input type="number" min="0" style={iSt} placeholder="e.g. 2800" value={newT.depositAmount} onChange={(e) => setNewT((p) => ({ ...p, depositAmount: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 12, justifyContent: "flex-end" }}>
                <Btn small variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
                <Btn small onClick={saveNew}>Save Tenant</Btn>
              </div>
            </div>
          )}

          {past.length > 0 && (
            <>
              <Divider />
              <SLabel color={C.muted}>Previous Tenants ({past.length})</SLabel>
              {[...past].reverse().map((t) => (
                <TenantRow key={t.tid} t={t} isCurrent={false} onEndLease={() => {}} onSave={(u) => onSaveTenant(unit.uid, u)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

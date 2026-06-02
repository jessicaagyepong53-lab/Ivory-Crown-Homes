import { useState } from "react";
import { C } from "../constants/colors";
import { fmt } from "../utils/formatters";
import { today } from "../utils/helpers";
import Badge from "../components/ui/Badge";
import { card, th, td, sGrid, iSt } from "../styles/shared";

// Months elapsed between two dates (floor)
function monthsElapsed(start, end) {
  if (!start) return 0;
  const s = new Date(start), e = new Date(end);
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

export default function SecurityDeposits({ allUnits, occupiedUnits, activeTenants, onSaveTenant }) {
  // uid → draft deposit amount string while editing
  const [editing, setEditing] = useState({});

  const activeRows = allUnits.filter((u) => u.tenants.some((t) => t.leaseStatus === "active"));

  // Per-row calculations
  function rowCalc(u, a) {
    const depAmt   = a.depositAmount != null ? Number(a.depositAmount) : u.monthlyRent;
    const months   = monthsElapsed(a.leaseStart, today);
    const rentPaid = months * u.monthlyRent;
    const depPaid  = a.depositPaid ? depAmt : 0;
    const total    = rentPaid + depPaid;
    return { depAmt, months, rentPaid, depPaid, total };
  }

  const totalDepHeld = activeRows.reduce((s, u) => {
    const a = u.tenants.find((t) => t.leaseStatus === "active");
    const { depPaid } = rowCalc(u, a);
    return s + depPaid;
  }, 0);

  const totalRentPaid = activeRows.reduce((s, u) => {
    const a = u.tenants.find((t) => t.leaseStatus === "active");
    const { rentPaid } = rowCalc(u, a);
    return s + rentPaid;
  }, 0);

  const collected = activeTenants.filter((t) => t.depositPaid).length;
  const pending   = activeTenants.filter((t) => !t.depositPaid).length;

  function startEdit(uid, currentAmt) {
    setEditing((p) => ({ ...p, [uid]: String(currentAmt) }));
  }

  function saveDepAmt(u, a) {
    const val = Number(editing[u.uid]);
    if (!isNaN(val) && val >= 0) {
      onSaveTenant(u.uid, { ...a, depositAmount: val });
    }
    setEditing((p) => { const n = { ...p }; delete n[u.uid]; return n; });
  }

  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Security Deposits</div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
        Security deposit is a separate one-time payment. It counts toward the tenant's total payments collected.
        Click the deposit amount to edit it per tenant.
      </p>

      {/* Summary cards */}
      <div className="stat-grid" style={sGrid}>
        {[
          { l: "Deposits Held",   v: fmt(totalDepHeld),  a: C.gold,  ab: C.goldBg  },
          { l: "Rent Collected",  v: fmt(totalRentPaid), a: C.teal,  ab: C.tealBg  },
          { l: "Deposits — Paid", v: collected,          a: C.sage,  ab: C.sageBg  },
          { l: "Deposits — Due",  v: pending,            a: C.rose,  ab: C.roseBg  },
        ].map((s) => (
          <div key={s.l} style={{ background: C.surface, border: `1px solid ${s.a}55`, borderRadius: 12, padding: "17px 21px", position: "relative", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: s.a }} />
            <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: s.ab, opacity: 0.6 }} />
            <div style={{ fontSize: 25, fontWeight: 700, color: s.a }}>{s.v}</div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Deposits table */}
      <div style={card}>
        <div className="tbl-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Block", "Unit", "Tenant", "Monthly Rent", "Months Paid", "Rent Total", "Deposit Amount", "Dep. Status", "Total Collected", "Actions"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeRows.map((u) => {
              const a = u.tenants.find((t) => t.leaseStatus === "active");
              const { depAmt, months, rentPaid, depPaid, total } = rowCalc(u, a);
              const isEditing = u.uid in editing;

              return (
                <tr key={u.uid}>
                  <td style={td}>{u.blockName}</td>
                  <td style={td}><b>{u.name}</b></td>
                  <td style={td}>{a.name}</td>
                  <td style={td}>{fmt(u.monthlyRent)}</td>
                  <td style={{ ...td, textAlign: "center" }}>{months} mo</td>
                  <td style={td}><span style={{ color: C.teal, fontWeight: 600 }}>{fmt(rentPaid)}</span></td>

                  {/* Editable deposit amount */}
                  <td style={td}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <input
                          type="number"
                          min="0"
                          autoFocus
                          style={{ ...iSt, width: 100, padding: "4px 8px", fontSize: 12 }}
                          value={editing[u.uid]}
                          onChange={(e) => setEditing((p) => ({ ...p, [u.uid]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveDepAmt(u, a); if (e.key === "Escape") setEditing((p) => { const n = { ...p }; delete n[u.uid]; return n; }); }}
                        />
                        <button onClick={() => saveDepAmt(u, a)} style={{ background: C.teal, border: "none", color: "#fff", borderRadius: 5, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontFamily: "Georgia,serif", fontWeight: 700 }}>✓</button>
                      </div>
                    ) : (
                      <span
                        onClick={() => startEdit(u.uid, depAmt)}
                        title="Click to edit deposit amount"
                        style={{ color: C.gold, fontWeight: 700, cursor: "pointer", borderBottom: `1px dashed ${C.gold}88`, paddingBottom: 1 }}
                      >
                        {fmt(depAmt)}
                      </span>
                    )}
                  </td>

                  <td style={td}>
                    <Badge
                      label={a.depositPaid ? "Collected" : "Pending"}
                      color={a.depositPaid ? C.sage : C.rose}
                      bg={a.depositPaid ? C.sageBg : C.roseBg}
                    />
                  </td>

                  {/* Total = rent + deposit (if paid) */}
                  <td style={td}>
                    <b style={{ color: C.text }}>{fmt(total)}</b>
                    <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>
                      rent {fmt(rentPaid)}{a.depositPaid ? ` + dep ${fmt(depPaid)}` : ""}
                    </div>
                  </td>

                  <td style={td}>
                    <button
                      onClick={() => onSaveTenant(u.uid, { ...a, depositPaid: !a.depositPaid })}
                      style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontFamily: "Georgia,serif", whiteSpace: "nowrap" }}
                    >
                      {a.depositPaid ? "Mark Pending" : "Mark Collected"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ ...td, color: C.muted, fontStyle: "italic" }}>Totals (active tenants)</td>
              <td style={{ ...td, fontWeight: 700, color: C.teal }}>{fmt(totalRentPaid)}</td>
              <td style={{ ...td, fontWeight: 700, color: C.gold }}>{fmt(totalDepHeld)}</td>
              <td style={td} />
              <td style={{ ...td, fontWeight: 700, color: C.text }}>{fmt(totalRentPaid + totalDepHeld)}</td>
              <td style={td} />
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </>
  );
}

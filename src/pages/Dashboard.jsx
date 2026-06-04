import { useState } from "react";
import { C } from "../constants/colors";
import { fmt, fmtDate } from "../utils/formatters";
import { getReminderStatus, today } from "../utils/helpers";
import Badge from "../components/ui/Badge";
import { card, cTitle, th, td, sGrid } from "../styles/shared";

// Cap at leaseEnd so rent paid never exceeds the agreed lease term
function monthsElapsed(start, end) {
  if (!start) return 0;
  const s   = new Date(start);
  const cap = end ? new Date(Math.min(new Date(end), today)) : today;
  return Math.max(0, (cap.getFullYear() - s.getFullYear()) * 12 + (cap.getMonth() - s.getMonth()));
}

function calcUnit(u, maint) {
  const a        = u.tenants.find((t) => t.leaseStatus === "active");
  const months   = a ? monthsElapsed(a.leaseStart, a.leaseEnd) : 0;
  // Use stored advanceAmount if available (actual payment), else fall back to months × rent
  const rentPaid = a
    ? (Number(a.advanceAmount) > 0 ? Number(a.advanceAmount) : months * u.monthlyRent)
    : 0;
  const depAmt   = a ? (a.depositAmount != null ? Number(a.depositAmount) : u.monthlyRent) : 0;
  const depPaid  = a?.depositPaid ? depAmt : 0;
  const maintCost = maint.filter((m) => m.unitId === u.uid).reduce((s, m) => s + (m.cost || 0), 0);
  return { a, months, rentPaid, depPaid, maintCost };
}

function StatCard({ label, val, accent, accentBg }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${accent}55`, borderRadius: 12, padding: "17px 21px", position: "relative", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: accent, borderRadius: "4px 0 0 4px" }} />
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: accentBg || accent + "22", opacity: 0.5 }} />
      <div style={{ fontSize: 25, fontWeight: 700, color: accent, lineHeight: 1.2 }}>{val}</div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>{label}</div>
    </div>
  );
}

const selSt = {
  background: C.deep, border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "Georgia,serif", cursor: "pointer",
};

export default function Dashboard({ totalRev, totalMonthlyRent, occupiedUnits, allUnits, blocks, maint, dueSoonCount, overdueCount, reminderUnits, totalRentPaid, totalDepHeld, onRecordPayment }) {
  const [filterBlock, setFilterBlock] = useState("");
  const [filterUnit,  setFilterUnit]  = useState("");
  const [payInput,    setPayInput]    = useState({}); // tid → input string
  const [payDate,     setPayDate]     = useState({}); // tid → date string

  const blockUnits  = filterBlock ? allUnits.filter((u) => u.blockId === filterBlock) : allUnits;
  const scopeUnits  = filterUnit  ? blockUnits.filter((u) => u.uid === filterUnit)    : blockUnits;

  function onBlockChange(bid) { setFilterBlock(bid); setFilterUnit(""); }

  const scopeTotals = scopeUnits.reduce((acc, u) => {
    const maintCost = maint.filter((m) => m.unitId === u.uid).reduce((s, m) => s + (m.cost || 0), 0);
    const rentPaid  = u.tenants.reduce((s, t) => s + Math.max(0, (Number(t.advanceAmount) > 0 ? Number(t.advanceAmount) : 0) - (Number(t.refundAmount) || 0)), 0);
    const depPaid   = u.tenants.reduce((s, t) => s + (t.depositPaid ? (t.depositAmount != null ? Number(t.depositAmount) : u.monthlyRent) : 0), 0);
    return { rentPaid: acc.rentPaid + rentPaid, depPaid: acc.depPaid + depPaid, maintCost: acc.maintCost + maintCost };
  }, { rentPaid: 0, depPaid: 0, maintCost: 0 });

  // All active tenants with a balance owed
  const balanceRows = allUnits.flatMap((u) => {
    const a = u.tenants.find((t) => t.leaseStatus === "active");
    if (!a || !(Number(a.balanceOwed) > 0)) return [];
    return [{ unit: u, tenant: a, balance: Number(a.balanceOwed) }];
  });
  const totalBalanceOwed = balanceRows.reduce((s, r) => s + r.balance, 0);

  const scopeLabel = filterUnit
    ? allUnits.find((u) => u.uid === filterUnit)?.name
    : filterBlock
    ? blocks.find((b) => b.bid === filterBlock)?.name
    : "All Properties";

  return (
    <>
      {/* ── Global stat cards ── */}
      <div className="stat-grid" style={sGrid}>
        <StatCard label="Current Monthly Revenue"  val={fmt(totalRev)}                                  accent={C.gold}     accentBg={C.goldBg}  />
        <StatCard label="Total Monthly Rent (All)"  val={fmt(totalMonthlyRent)}                          accent={C.teal}     accentBg={C.tealBg}  />
        <StatCard label="Annual Revenue"            val={fmt(totalRev * 12)}                             accent={C.sky}      accentBg={C.skyBg}   />
        <StatCard label="Occupied Units"      val={`${occupiedUnits.length}/${allUnits.length}`}   accent={C.sage}     accentBg={C.sageBg}  />
        <StatCard label="Blocks / Properties" val={blocks.length}                                  accent={C.lavender} accentBg={C.lavBg}   />
        <StatCard label="Pending Maintenance" val={maint.filter((m) => m.status === "Pending").length} accent={C.rose} accentBg={C.roseBg} />
        <StatCard label="Lease Alerts (≤30d)" val={dueSoonCount + overdueCount}                    accent={C.amber}    accentBg={C.amberBg} />
        <StatCard label="Total Rent Paid"     val={fmt(totalRentPaid)}                             accent={C.teal}     accentBg={C.tealBg}  />
        <StatCard label="Total Security Deposits" val={fmt(totalDepHeld)}                          accent={C.gold}     accentBg={C.goldBg}  />
        <StatCard label="Total Balance Owed"   val={totalBalanceOwed > 0 ? fmt(totalBalanceOwed) : "None"} accent={totalBalanceOwed > 0 ? C.rose : C.sage} accentBg={totalBalanceOwed > 0 ? C.roseBg : C.sageBg} />
      </div>

      {/* ── Financial Breakdown (filterable) ── */}
      <div className="app-card" style={card}>
        {/* Header + filters */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={cTitle}>Financial Breakdown</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Viewing: <strong style={{ color: C.text }}>{scopeLabel}</strong>
              {filterUnit || filterBlock
                ? <span style={{ marginLeft: 8, color: C.teal, fontSize: 11 }}>({scopeUnits.length} unit{scopeUnits.length !== 1 ? "s" : ""})</span>
                : <span style={{ marginLeft: 8, color: C.muted, fontSize: 11 }}>({allUnits.length} units across {blocks.length} properties)</span>
              }
            </div>
          </div>
          <div className="fin-filter-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={filterBlock} onChange={(e) => onBlockChange(e.target.value)} style={selSt}>
              <option value="">All Blocks / Properties</option>
              {blocks.map((b) => <option key={b.bid} value={b.bid}>{b.name}</option>)}
            </select>
            <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} style={{ ...selSt, opacity: filterBlock ? 1 : 0.45 }} disabled={!filterBlock}>
              <option value="">All Units</option>
              {blockUnits.map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
            </select>
            {(filterBlock || filterUnit) && (
              <button onClick={() => { setFilterBlock(""); setFilterUnit(""); }}
                style={{ ...selSt, background: C.roseBg, color: C.rose, border: `1px solid ${C.rose}44` }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Scope summary cards */}
        <div className="stat-grid" style={{ ...sGrid, marginBottom: 20 }}>
          <StatCard label="Rent Paid"        val={fmt(scopeTotals.rentPaid)}                          accent={C.teal}  accentBg={C.tealBg}  />
          <StatCard label="Security Deposits"     val={fmt(scopeTotals.depPaid)}                        accent={C.gold}  accentBg={C.goldBg}  />
          <StatCard label="Rent + Security Deposit" val={fmt(scopeTotals.rentPaid + scopeTotals.depPaid)} accent={C.sky}   accentBg={C.skyBg}   />
          <StatCard label="Maintenance Cost" val={fmt(scopeTotals.maintCost)}                         accent={C.rose}  accentBg={C.roseBg}  />
        </div>

        {/* Breakdown table */}
        <div className="tbl-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Block / Unit</th>
                <th style={th}>Tenant</th>
                <th style={th}>Monthly Rent</th>
                <th style={th}>Rent Paid</th>
                <th style={th}>Security Deposit</th>
                <th style={th}>Rent + Sec. Deposit</th>
                <th style={th}>Balance Owed</th>
                <th style={th}>Maint Cost</th>
              </tr>
            </thead>
            <tbody>
              {scopeUnits.length === 0 && (
                <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: C.muted, padding: 28 }}>No units match the selected filter.</td></tr>
              )}
              {scopeUnits.flatMap((u) => {
                const maintCost = maint.filter((m) => m.unitId === u.uid).reduce((s, m) => s + (m.cost || 0), 0);
                if (u.tenants.length === 0) return [(
                  <tr key={u.uid}>
                    <td style={td}><b style={{ color: C.text }}>{u.blockName}</b><span style={{ color: C.muted }}> / {u.name}</span></td>
                    <td style={td}><span style={{ color: C.faint, fontStyle: "italic" }}>Vacant</span></td>
                    <td style={td}>{fmt(u.monthlyRent)}</td>
                    <td style={td} /><td style={td} /><td style={td} /><td style={td} /><td style={td} />
                  </tr>
                )];
                return u.tenants.map((t, i) => {
                  const isActive = t.leaseStatus === "active";
                  const rentPaid = Math.max(0, (Number(t.advanceAmount) > 0 ? Number(t.advanceAmount) : 0) - (Number(t.refundAmount) || 0));
                  const depAmt   = t.depositAmount != null ? Number(t.depositAmount) : u.monthlyRent;
                  const depPaid  = t.depositPaid ? depAmt : 0;
                  const balance  = isActive ? (Number(t.balanceOwed) || 0) : 0;
                  const sy = t.leaseStart ? new Date(t.leaseStart).getFullYear() : "";
                  const ey = (t.leaseEnd || t.cancelDate) ? new Date(t.leaseEnd || t.cancelDate).getFullYear() : "";
                  const period = sy && ey && sy !== ey ? `${sy}–${ey}` : `${sy}`;
                  return (
                    <tr key={t.tid || `${u.uid}-${i}`} style={{ opacity: isActive ? 1 : 0.75, background: isActive ? "transparent" : C.panel }}>
                      <td style={td}>
                        {i === 0
                          ? <><b style={{ color: C.text }}>{u.blockName}</b><span style={{ color: C.muted }}> / {u.name}</span></>
                          : <span style={{ color: C.faint, paddingLeft: 10 }}>↳ {u.name}</span>}
                      </td>
                      <td style={td}>
                        <span style={{ color: isActive ? C.text : C.muted, fontWeight: isActive ? 600 : 400 }}>{t.name}</span>
                        {!isActive && period && <span style={{ fontSize: 10, color: C.lavender, marginLeft: 6, background: C.lavBg, borderRadius: 4, padding: "1px 5px" }}>{period}</span>}
                      </td>
                      <td style={td}>{fmt(Number(t.monthlyRent) || u.monthlyRent)}</td>
                      <td style={{ ...td, color: C.teal, fontWeight: 600 }}>{rentPaid > 0 ? fmt(rentPaid) : <span style={{ color: C.faint }}>—</span>}</td>
                      <td style={{ ...td, color: C.gold }}>{depPaid > 0 ? fmt(depPaid) : <span style={{ color: C.faint }}>—</span>}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{fmt(rentPaid + depPaid)}</td>
                      <td style={{ ...td, color: balance > 0 ? C.rose : C.faint, fontWeight: balance > 0 ? 700 : 400 }}>{balance > 0 ? fmt(balance) : "—"}</td>
                      <td style={{ ...td, color: maintCost > 0 ? C.rose : C.faint }}>{i === 0 && maintCost > 0 ? fmt(maintCost) : "—"}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
            {scopeUnits.length > 1 && (
              <tfoot>
                <tr style={{ background: C.panel }}>
                  <td style={{ ...td, fontWeight: 700, color: C.text }} colSpan={2}>Totals</td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmt(scopeUnits.reduce((s, u) => s + u.tenants.reduce((ts, t) => ts + (Number(t.monthlyRent) || u.monthlyRent || 0), 0), 0))}</td>
                  <td style={{ ...td, fontWeight: 700, color: C.teal }}>{fmt(scopeTotals.rentPaid)}</td>
                  <td style={{ ...td, fontWeight: 700, color: C.gold }}>{fmt(scopeTotals.depPaid)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmt(scopeTotals.rentPaid + scopeTotals.depPaid)}</td>
                  <td style={{ ...td, fontWeight: 700, color: C.rose }}>{fmt(scopeUnits.reduce((s,u)=>{ const a=u.tenants.find(t=>t.leaseStatus==="active"); return s+(Number(a?.balanceOwed)||0); },0) || 0)}</td>
                  <td style={{ ...td, fontWeight: 700, color: C.rose }}>{scopeTotals.maintCost > 0 ? fmt(scopeTotals.maintCost) : "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Balance Owed by Tenants ── */}
      {balanceRows.length > 0 && (
        <div className="app-card" style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={cTitle}>⚠ Outstanding Balances</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Tenants with payments still outstanding</div>
            </div>
            <div style={{ background: C.roseBg, border: `1.5px solid ${C.rose}55`, borderRadius: 10, padding: "10px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.rose }}>{fmt(totalBalanceOwed)}</div>
              <div style={{ fontSize: 10, color: C.rose, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 2 }}>Total Owed</div>
            </div>
          </div>
          <div className="tbl-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Block / Unit</th>
                  <th style={th}>Tenant</th>
                  <th style={th}>Monthly Rent</th>
                  <th style={th}>Total Expected</th>
                  <th style={th}>Amount Received</th>
                  <th style={th}>Balance Owed</th>
                  <th style={th}>Record Payment</th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.map(({ unit: u, tenant: a, balance }) => {
                  const advAmt   = Number(a.advanceAmount) || 0;
                  const dep      = Number(a.depositAmount) || 0;
                  const total    = advAmt + dep;
                  const received = total - balance;
                  const tid      = a.tid;
                  const inputVal  = payInput[tid] ?? "";
                  const payAmt    = Number(inputVal) || 0;
                  const newBal    = Math.max(0, balance - payAmt);
                  const today     = new Date().toISOString().slice(0, 10);
                  const dateVal   = payDate[tid] ?? today;
                  const lastAmt   = Number(a.lastPaymentAmount) || 0;
                  const lastDate  = a.lastPaymentDate || "";
                  return (
                    <tr key={tid}>
                      <td style={td}><b style={{ color: C.text }}>{u.blockName}</b><span style={{ color: C.muted }}> / {u.name}</span></td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {a.name}
                        {lastDate && (
                          <div style={{ fontSize: 11, color: C.sage, marginTop: 2 }}>
                            Last paid: <b>GHS {lastAmt.toLocaleString()}</b> on {lastDate}
                          </div>
                        )}
                      </td>
                      <td style={td}>{fmt(u.monthlyRent)}</td>
                      <td style={td}>{total > 0 ? fmt(total) : <span style={{ color: C.faint }}>—</span>}</td>
                      <td style={{ ...td, color: C.sage, fontWeight: 600 }}>{total > 0 ? fmt(received) : <span style={{ color: C.faint }}>—</span>}</td>
                      <td style={{ ...td, color: C.rose, fontWeight: 700 }}>{fmt(balance)}</td>
                      <td style={td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div className="pay-input-row" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="number"
                              min="0"
                              max={balance}
                              placeholder="Amount paid"
                              value={inputVal}
                              onChange={(e) => setPayInput((p) => ({ ...p, [tid]: e.target.value }))}
                              style={{ width: 110, padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: "Georgia,serif", color: C.text, background: C.deep }}
                            />
                            <input
                              type="date"
                              value={dateVal}
                              onChange={(e) => setPayDate((p) => ({ ...p, [tid]: e.target.value }))}
                              style={{ padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: "Georgia,serif", color: C.text, background: C.deep }}
                            />
                          </div>
                          {payAmt > 0 && (
                            <button
                              onClick={() => {
                                onRecordPayment(tid, payAmt, dateVal);
                                setPayInput((p) => { const n = { ...p }; delete n[tid]; return n; });
                                setPayDate((p)  => { const n = { ...p }; delete n[tid]; return n; });
                              }}
                              style={{ padding: "4px 10px", background: C.sage, border: "none", color: "#fff", borderRadius: 6, fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "flex-start" }}
                              title={`New balance: GHS ${newBal.toLocaleString()}`}
                            >
                              ✓ {newBal === 0 ? "Mark Paid" : `GHS ${newBal.toLocaleString()} left`}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {balanceRows.length > 1 && (
                <tfoot>
                  <tr style={{ background: C.panel }}>
                    <td style={{ ...td, fontWeight: 700 }} colSpan={5}>Total</td>
                    <td style={{ ...td, fontWeight: 700, color: C.rose }}>{fmt(totalBalanceOwed)}</td>
                    <td style={td} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Lease Reminders ── */}
      {reminderUnits.length > 0 && (
        <div className="app-card" style={card}>
          <div style={cTitle}>⚠ Active Lease Reminders</div>
          <div className="tbl-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Location</th>
                  <th style={th}>Tenant</th>
                  <th style={th}>Lease End</th>
                  <th style={th}>Alert</th>
                  <th style={th}>Rent</th>
                </tr>
              </thead>
              <tbody>
                {reminderUnits.map((u) => {
                  const a  = u.tenants.find((t) => t.leaseStatus === "active");
                  const rs = getReminderStatus(a.leaseEnd);
                  return (
                    <tr key={u.uid}>
                      <td style={td}><b>{u.blockName}</b><span style={{ color: C.muted }}> / {u.name}</span></td>
                      <td style={td}>{a.name}</td>
                      <td style={td}>{fmtDate(a.leaseEnd)}</td>
                      <td style={td}>{rs && <Badge label={rs.label} color={rs.color} bg={rs.bg} />}</td>
                      <td style={td}>{fmt(u.monthlyRent)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Revenue by Block ── */}
      <div style={card}>
        <div style={cTitle}>Revenue by Block / Property</div>
        {blocks.map((b) => {
          const bRev = b.units.reduce((s, u) => { const a = u.tenants.find((t) => t.leaseStatus === "active"); return s + (a ? u.monthlyRent : 0); }, 0);
          const bOcc = b.units.filter((u) => u.tenants.some((t) => t.leaseStatus === "active")).length;
          const pct  = b.units.length ? Math.round((bOcc / b.units.length) * 100) : 0;
          const barCol = pct === 100 ? C.sage : pct === 0 ? C.faint : C.teal;
          return (
            <div key={b.bid} className="rev-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: `1px solid ${C.borderLight}`, flexWrap: "wrap" }}>
              <div className="rev-name" style={{ fontSize: 13, fontWeight: 700, minWidth: 150, color: C.text }}>{b.name}</div>
              <div style={{ flex: 1, minWidth: 80, height: 8, background: C.panel, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.borderLight}` }}>
                <div style={{ width: `${pct}%`, height: "100%", background: barCol, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, minWidth: 80, textAlign: "right" }}>{bOcc}/{b.units.length}</div>
              <div className="rev-amt" style={{ fontSize: 13, fontWeight: 700, color: C.gold, minWidth: 120, textAlign: "right" }}>{fmt(bRev)}/mo</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

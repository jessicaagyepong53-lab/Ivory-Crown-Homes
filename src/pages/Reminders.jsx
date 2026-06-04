import { C } from "../constants/colors";
import { fmt, fmtDate } from "../utils/formatters";
import { daysUntil, getReminderStatus, getLeaseStatus } from "../utils/helpers";
import Badge from "../components/ui/Badge";
import { card, cTitle, th, td } from "../styles/shared";

export default function Reminders({ allUnits }) {
  // Units where the DB says active but lease has expired → should vacate
  const vacateUnits = allUnits.filter((u) =>
    !u.tenants.some((t) => getLeaseStatus(t) === "active") &&
    u.tenants.some((t) => t.leaseStatus === "active")
  );

  // Units with a genuinely active lease (not expired)
  const activeUnits = allUnits.filter((u) => u.tenants.some((t) => getLeaseStatus(t) === "active"));

  const sorted = [...activeUnits].sort((a, b) => {
    const da = daysUntil(a.tenants.find((t) => getLeaseStatus(t) === "active").leaseEnd) ?? 999;
    const db = daysUntil(b.tenants.find((t) => getLeaseStatus(t) === "active").leaseEnd) ?? 999;
    return da - db;
  });

  const upcoming90 = allUnits.filter((u) => {
    const a = u.tenants.find((t) => getLeaseStatus(t) === "active");
    const d = a ? daysUntil(a.leaseEnd) : null;
    return d !== null && d > 0 && d <= 90;
  });

  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 14 }}>Lease Reminders</div>

      {/* Should Vacate — expired leases */}
      {vacateUnits.length > 0 && (
          <div className="app-card" style={{ ...card, border: `1px solid ${C.rose}44`, background: C.roseBg + "66", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>🏠</span>
            <div>
              <div style={{ fontWeight: 700, color: C.rose, fontSize: 14 }}>Should Vacate ({vacateUnits.length})</div>
              <div style={{ fontSize: 12, color: C.muted }}>Lease has ended — no renewal recorded. These tenants should be contacted.</div>
            </div>
          </div>
          <div className="tbl-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Block", "Unit", "Tenant", "Rent", "Lease Ended", "Days Over"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {vacateUnits.map((u) => {
                const t = [...u.tenants].filter((t) => t.leaseStatus === "active").slice(-1)[0];
                const dOver = t?.leaseEnd ? Math.abs(daysUntil(t.leaseEnd)) : null;
                return (
                  <tr key={u.uid}>
                    <td style={td}>{u.blockName}</td>
                    <td style={td}><b>{u.name}</b></td>
                    <td style={td}>{t?.name}</td>
                    <td style={td}>{fmt(u.monthlyRent)}</td>
                    <td style={td}>{fmtDate(t?.leaseEnd)}</td>
                    <td style={td}><Badge label={dOver !== null ? `${dOver}d over` : "—"} color={C.rose} bg={C.roseBg} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
        {[["Should Vacate", C.rose, C.roseBg], ["≤7 days", C.amber, C.amberBg], ["≤30 days", C.amber, C.amberBg], ["≤90 days", C.sky, C.skyBg], ["On track", C.sage, C.sageBg]].map(([l, c, b]) => (
          <Badge key={l} label={l} color={c} bg={b} />
        ))}
      </div>

      {/* All active leases table */}
      <div className="app-card" style={card}>
        <div style={cTitle}>All Active Leases</div>
        {sorted.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>No active leases.</div>
        ) : (
          <div className="tbl-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Block", "Unit", "Tenant", "Rent", "Lease End", "Days Left", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const a  = u.tenants.find((t) => getLeaseStatus(t) === "active");
                const rs = getReminderStatus(a.leaseEnd);
                const d  = daysUntil(a.leaseEnd);
                return (
                  <tr key={u.uid}>
                    <td style={td}>{u.blockName}</td>
                    <td style={td}><b>{u.name}</b></td>
                    <td style={td}>{a.name}</td>
                    <td style={td}>{fmt(u.monthlyRent)}</td>
                    <td style={td}>{fmtDate(a.leaseEnd)}</td>
                    <td style={td}>{d !== null ? `${d}d` : "—"}</td>
                    <td style={td}>{rs && <Badge label={rs.label} color={rs.color} bg={rs.bg} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* 3-month advance reminders */}
      <div className="app-card" style={card}>
        <div style={cTitle}>Expiring Within 3 Months</div>
        {upcoming90.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>None in the next 90 days.</div>
        ) : (
          upcoming90.map((u) => {
            const a = u.tenants.find((t) => getLeaseStatus(t) === "active");
            const d = daysUntil(a.leaseEnd);
            return (
              <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: `1px solid ${C.borderLight}` }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: C.skyBg, border: `1px solid ${C.sky}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.sky }}>
                  {d <= 30 ? `${d}d` : `${Math.ceil(d / 30)}mo`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: C.text }}>{u.blockName} / {u.name} — {a.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Lease ends {fmtDate(a.leaseEnd)} · {fmt(u.monthlyRent)}/mo</div>
                </div>
                <Badge label={`${d} days`} color={d <= 30 ? C.amber : C.sky} bg={d <= 30 ? C.amberBg : C.skyBg} />
              </div>
            );
          })
        )}
      </div>
    </>
  );
}


import { C } from "../constants/colors";
import { fmt, fmtDate } from "../utils/formatters";
import { daysUntil, getReminderStatus } from "../utils/helpers";
import Badge from "../components/ui/Badge";
import { card, cTitle, th, td } from "../styles/shared";

export default function Reminders({ allUnits }) {
  const activeUnits = allUnits.filter((u) => u.tenants.find((t) => t.leaseStatus === "active"));

  const sorted = [...activeUnits].sort((a, b) => {
    const da = daysUntil(a.tenants.find((t) => t.leaseStatus === "active").leaseEnd) ?? 999;
    const db = daysUntil(b.tenants.find((t) => t.leaseStatus === "active").leaseEnd) ?? 999;
    return da - db;
  });

  const upcoming90 = allUnits.filter((u) => {
    const a = u.tenants.find((t) => t.leaseStatus === "active");
    const d = a ? daysUntil(a.leaseEnd) : null;
    return d !== null && d > 0 && d <= 90;
  });

  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 14 }}>Lease Reminders</div>

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
        {[["Overdue", C.rose, C.roseBg], ["≤7 days", C.amber, C.amberBg], ["≤30 days", C.amber, C.amberBg], ["≤90 days", C.sky, C.skyBg], ["On track", C.sage, C.sageBg]].map(([l, c, b]) => (
          <Badge key={l} label={l} color={c} bg={b} />
        ))}
      </div>

      {/* All active leases table */}
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Block", "Unit", "Tenant", "Rent", "Lease End", "Days Left", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {sorted.map((u) => {
              const a  = u.tenants.find((t) => t.leaseStatus === "active");
              const rs = getReminderStatus(a.leaseEnd);
              const d  = daysUntil(a.leaseEnd);
              return (
                <tr key={u.uid}>
                  <td style={td}>{u.blockName}</td>
                  <td style={td}><b>{u.name}</b></td>
                  <td style={td}>{a.name}</td>
                  <td style={td}>{fmt(u.monthlyRent)}</td>
                  <td style={td}>{fmtDate(a.leaseEnd)}</td>
                  <td style={td}>{d !== null ? (d < 0 ? `${Math.abs(d)}d over` : `${d}d`) : ""}</td>
                  <td style={td}>{rs && <Badge label={rs.label} color={rs.color} bg={rs.bg} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3-month advance reminders */}
      <div style={card}>
        <div style={cTitle}>3-Month Advance Reminders</div>
        {upcoming90.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>None in the next 90 days.</div>
        ) : (
          upcoming90.map((u) => {
            const a = u.tenants.find((t) => t.leaseStatus === "active");
            const d = daysUntil(a.leaseEnd);
            return (
              <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: `1px solid ${C.borderLight}` }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: C.skyBg, border: `1px solid ${C.sky}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.sky }}>
                  {Math.ceil(d / 30)}mo
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: C.text }}>{u.blockName} / {u.name} — {a.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Lease ends {fmtDate(a.leaseEnd)} · {fmt(u.monthlyRent)}/mo</div>
                </div>
                <Badge label={`${d} days`} color={C.sky} bg={C.skyBg} />
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

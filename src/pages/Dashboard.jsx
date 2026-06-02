import { C } from "../constants/colors";
import { fmt, fmtDate } from "../utils/formatters";
import { getReminderStatus } from "../utils/helpers";
import Badge from "../components/ui/Badge";
import { card, cTitle, th, td, sGrid } from "../styles/shared";

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

export default function Dashboard({ totalRev, occupiedUnits, allUnits, blocks, maint, dueSoonCount, overdueCount, reminderUnits }) {
  return (
    <>
      <div className="stat-grid" style={sGrid}>
        <StatCard label="Monthly Revenue"    val={fmt(totalRev)}                                  accent={C.gold}     accentBg={C.goldBg}  />
        <StatCard label="Annual Revenue"     val={fmt(totalRev * 12)}                             accent={C.sky}      accentBg={C.skyBg}   />
        <StatCard label="Occupied Units"     val={`${occupiedUnits.length}/${allUnits.length}`}   accent={C.sage}     accentBg={C.sageBg}  />
        <StatCard label="Blocks / Properties" val={blocks.length}                                 accent={C.lavender} accentBg={C.lavBg}   />
        <StatCard label="Pending Maintenance" val={maint.filter((m) => m.status === "Pending").length} accent={C.rose} accentBg={C.roseBg} />
        <StatCard label="Lease Alerts (≤30d)" val={dueSoonCount + overdueCount}                   accent={C.amber}    accentBg={C.amberBg} />
      </div>

      {reminderUnits.length > 0 && (
        <div style={card}>
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

      <div style={card}>
        <div style={cTitle}>Revenue by Block / Property</div>
        {blocks.map((b) => {
          const bRev   = b.units.reduce((s, u) => { const a = u.tenants.find((t) => t.leaseStatus === "active"); return s + (a ? u.monthlyRent : 0); }, 0);
          const bOcc   = b.units.filter((u) => u.tenants.some((t) => t.leaseStatus === "active")).length;
          const pct    = b.units.length ? Math.round((bOcc / b.units.length) * 100) : 0;
          const barCol = pct === 100 ? C.sage : pct === 0 ? C.faint : C.teal;
          return (
            <div key={b.bid} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, minWidth: 150, color: C.text }}>{b.name}</div>
              <div style={{ flex: 1, height: 8, background: C.panel, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.borderLight}` }}>
                <div style={{ width: `${pct}%`, height: "100%", background: barCol, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, minWidth: 80, textAlign: "right" }}>{bOcc}/{b.units.length}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, minWidth: 120, textAlign: "right" }}>{fmt(bRev)}/mo</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

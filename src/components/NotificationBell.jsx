import { useState, useEffect, useRef } from "react";
import { C } from "../constants/colors";
import { daysUntil, getLeaseStatus } from "../utils/helpers";
import { fmtDate } from "../utils/formatters";

export default function NotificationBell({ allUnits }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Build notification lists ──────────────────────────────────────────────

  // Tenants whose lease has passed with no renewal (should vacate)
  const vacate = allUnits.filter((u) =>
    !u.tenants.some((t) => getLeaseStatus(t) === "active") &&
    u.tenants.some((t) => t.leaseStatus === "active")
  ).map((u) => {
    const t = [...u.tenants].filter((t) => t.leaseStatus === "active").slice(-1)[0];
    return { u, t, daysOver: t?.leaseEnd ? Math.abs(daysUntil(t.leaseEnd)) : 0 };
  }).sort((a, b) => b.daysOver - a.daysOver);

  // Active tenants with lease ending in ≤30 days
  const warn1m = allUnits.flatMap((u) => {
    const a = u.tenants.find((t) => getLeaseStatus(t) === "active");
    if (!a) return [];
    const d = daysUntil(a.leaseEnd);
    if (d === null || d < 0 || d > 30) return [];
    return [{ u, a, d }];
  }).sort((a, b) => a.d - b.d);

  // Active tenants with lease ending in 31–90 days
  const warn3m = allUnits.flatMap((u) => {
    const a = u.tenants.find((t) => getLeaseStatus(t) === "active");
    if (!a) return [];
    const d = daysUntil(a.leaseEnd);
    if (d === null || d <= 30 || d > 90) return [];
    return [{ u, a, d }];
  }).sort((a, b) => a.d - b.d);

  const total = vacate.length + warn1m.length + warn3m.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ position: "relative", width: 38, height: 38, borderRadius: 10, border: `1px solid ${total > 0 ? C.amber + "88" : C.border}`, background: total > 0 ? C.amberBg : C.deep, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, transition: "all 0.15s" }}
        title="Lease Notifications"
      >
        🔔
        {total > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, background: vacate.length > 0 ? C.rose : C.amber, color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", border: "2px solid #fff" }}>
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{ position: "absolute", right: 0, top: 46, width: 340, background: "#fffdf9", border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.14)", zIndex: 200, maxHeight: "80vh", overflowY: "auto", fontFamily: "Georgia,serif" }}>
          {/* Header */}
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🔔 Lease Notifications</span>
            {total === 0 && <span style={{ fontSize: 11, color: C.sage }}>All clear ✓</span>}
          </div>

          {total === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: C.muted }}>
              No upcoming or overdue leases.
            </div>
          )}

          {/* Should vacate */}
          {vacate.length > 0 && (
            <Section title="🏠 Should Vacate" subtitle="Lease has ended — no renewal" color={C.rose} bg={C.roseBg}>
              {vacate.map(({ u, t, daysOver }) => (
                <NotifItem
                  key={u.uid}
                  label={`${u.blockName} / ${u.name}`}
                  name={t?.name}
                  detail={`Ended ${fmtDate(t?.leaseEnd)} · ${daysOver}d ago`}
                  color={C.rose}
                  bg={C.roseBg}
                  badge={`${daysOver}d over`}
                />
              ))}
            </Section>
          )}

          {/* ≤30 days */}
          {warn1m.length > 0 && (
            <Section title="⚠ Expiring Within 1 Month" subtitle="Renew or plan for vacancy" color={C.amber} bg={C.amberBg}>
              {warn1m.map(({ u, a, d }) => (
                <NotifItem
                  key={u.uid}
                  label={`${u.blockName} / ${u.name}`}
                  name={a.name}
                  detail={`Ends ${fmtDate(a.leaseEnd)}`}
                  color={C.amber}
                  bg={C.amberBg}
                  badge={`${d}d left`}
                />
              ))}
            </Section>
          )}

          {/* 31–90 days */}
          {warn3m.length > 0 && (
            <Section title="📅 Expiring Within 3 Months" subtitle="Plan ahead" color={C.sky} bg={C.skyBg}>
              {warn3m.map(({ u, a, d }) => (
                <NotifItem
                  key={u.uid}
                  label={`${u.blockName} / ${u.name}`}
                  name={a.name}
                  detail={`Ends ${fmtDate(a.leaseEnd)}`}
                  color={C.sky}
                  bg={C.skyBg}
                  badge={`${d}d left`}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, color, bg, children }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.borderLight}` }}>
      <div style={{ padding: "10px 16px 6px", background: bg + "88" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.5 }}>{title}</div>
        <div style={{ fontSize: 10, color: C.muted }}>{subtitle}</div>
      </div>
      <div style={{ paddingBottom: 4 }}>{children}</div>
    </div>
  );
}

function NotifItem({ label, name, detail, color, bg, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: `1px solid ${C.borderLight}44` }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color }}>{badge}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{name} · {detail}</div>
      </div>
    </div>
  );
}

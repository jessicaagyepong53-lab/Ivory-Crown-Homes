import { C } from "../constants/colors";
import { iSt, lSt, card, cTitle, th, td } from "../styles/shared";
import { fmt, fmtDate } from "../utils/formatters";
import { yr } from "../utils/helpers";
import Badge from "../components/ui/Badge";
import Avatar from "../components/ui/Avatar";
import Btn from "../components/ui/Btn";

export default function LeaseFilter({ allTenants, filteredTenants, allYears, filterMode, setFilterMode, filterYA, setFilterYA, filterYB, setFilterYB }) {

  function YrSel({ value, onChange, placeholder }) {
    return (
      <select style={{ ...iSt, width: "auto", minWidth: 100 }} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {allYears.map((y) => <option key={y}>{y}</option>)}
      </select>
    );
  }

  // Build period chips from tenant data
  const pairs = [];
  allTenants.forEach((t) => {
    const sy = yr(t.leaseStart), ey = yr(t.leaseEnd || t.cancelDate);
    if (sy && ey && sy !== ey) {
      const k = `${sy}–${ey}`;
      if (!pairs.find((p) => p.k === k)) pairs.push({ k, sy, ey });
    }
  });

  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Lease Year Filter</div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>Click a year chip or set a range to filter all tenants.</p>

      {/* Filter controls */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 22px", marginBottom: 18, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div>
          <label style={lSt}>Filter Mode</label>
          <div style={{ display: "flex", gap: 6 }}>
            {[["period", "Lease Period"], ["movein", "Move-in Year"], ["moveout", "Move-out Year"]].map(([v, l]) => (
              <button key={v} onClick={() => setFilterMode(v)} style={{ padding: "7px 14px", border: `1px solid ${filterMode === v ? C.teal : C.border}`, borderRadius: 8, background: filterMode === v ? C.tealBg : C.deep, color: filterMode === v ? C.teal : C.muted, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 600 }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div><label style={lSt}>From Year</label><YrSel value={filterYA} onChange={setFilterYA} placeholder="Any" /></div>
        <div><label style={lSt}>To Year</label><YrSel value={filterYB} onChange={setFilterYB} placeholder="Any" /></div>
        <Btn variant="ghost" small onClick={() => { setFilterYA(""); setFilterYB(""); }}>✕ Clear</Btn>
      </div>

      {/* Year chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {allYears.map((y) => (
          <button
            key={y}
            onClick={() => { setFilterYA(String(y)); setFilterYB(String(y)); }}
            style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${filterYA === String(y) && filterYB === String(y) ? C.teal : C.border}`, background: filterYA === String(y) && filterYB === String(y) ? C.tealBg : C.surface, color: filterYA === String(y) && filterYB === String(y) ? C.teal : C.muted, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 600, transition: "all 0.15s" }}
          >
            {y}
          </button>
        ))}
        {pairs.slice(0, 12).map(({ k, sy, ey }) => {
          const active = filterYA === String(sy) && filterYB === String(ey);
          return (
            <button
              key={k}
              onClick={() => { setFilterYA(String(sy)); setFilterYB(String(ey)); setFilterMode("period"); }}
              style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${active ? C.lavender : C.border}`, background: active ? C.lavBg : C.surface, color: active ? C.lavender : C.muted, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 600, transition: "all 0.15s" }}
            >
              {k}
            </button>
          );
        })}
      </div>

      {/* Results table */}
      <div style={card}>
        <div style={{ ...cTitle, marginBottom: 12 }}>
          {filteredTenants.length} Tenant{filteredTenants.length !== 1 ? "s" : ""} Found
          {filterYA && <span style={{ color: C.muted, fontWeight: 400 }}> — {filterYA}{filterYB && filterYB !== filterYA ? `–${filterYB}` : ""}</span>}
        </div>

        {filteredTenants.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>No tenants match this filter.</div>
        ) : (
          <div className="tbl-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Tenant", "Block / Unit", "Lease Period", "Status", "Rent", "Period"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filteredTenants.map((t) => {
                const sc = t.leaseStatus === "active" ? [C.sage, C.sageBg] : t.leaseStatus === "cancelled" ? [C.rose, C.roseBg] : [C.muted, "#f5f0eb"];
                const sy = yr(t.leaseStart), ey = yr(t.leaseEnd || t.cancelDate);
                const pl = sy && ey && sy !== ey ? `${sy}–${ey}` : sy ? `${sy}` : "—";
                return (
                  <tr key={t.tid}>
                    <td style={td}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={t.name} size={28} /><span style={{ fontWeight: 600 }}>{t.name}</span></div></td>
                    <td style={td}><span style={{ color: C.muted }}>{t.blockName}</span> / {t.unitName}</td>
                    <td style={td}>{fmtDate(t.leaseStart)} → {fmtDate(t.leaseEnd || t.cancelDate)}</td>
                    <td style={td}><Badge label={t.leaseStatus === "active" ? "Active" : t.leaseStatus === "cancelled" ? "Cancelled" : "Ended"} color={sc[0]} bg={sc[1]} /></td>
                    <td style={td}>{fmt(t.monthlyRent)}</td>
                    <td style={td}><Badge label={pl} color={C.lavender} bg={C.lavBg} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}

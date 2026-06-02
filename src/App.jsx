import { useState, useEffect } from "react";
import { C } from "./constants/colors";
import { TABS } from "./constants/options";
import { fmt } from "./utils/formatters";
import { today, yr, daysUntil } from "./utils/helpers";
import { fetchBlocks, createBlock, deleteBlock as apiDeleteBlock, addUnit as apiAddUnit, deleteUnit as apiDeleteUnit, addTenant as apiAddTenant, updateTenant as apiUpdateTenant } from "./api/blocks.js";
import { fetchMaintenance, createMaintenance, updateMaintenance as apiUpdateMaintenance } from "./api/maintenance.js";
import { verifyToken, logout as apiLogout } from "./api/auth.js";
import LoadingSpinner   from "./components/LoadingSpinner.jsx";
import LoginPage        from "./pages/LoginPage";
import Dashboard        from "./pages/Dashboard";
import Properties       from "./pages/Properties";
import LeaseFilter      from "./pages/LeaseFilter";
import Reminders        from "./pages/Reminders";
import Maintenance      from "./pages/Maintenance";
import SecurityDeposits from "./pages/SecurityDeposits";
import Settings        from "./pages/Settings";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin]             = useState(false);
  const [showAuthPrompt, setShowAuthPrompt]   = useState(false);
  const [pendingFn, setPendingFn]             = useState(null);
  const [tab, setTab]                         = useState("Dashboard");
  const [blocks, setBlocks]      = useState([]);
  const [maint, setMaint]        = useState([]);
  const [loading, setLoading]    = useState(true);
  const [apiError, setApiError]  = useState("");

  // Lease filter state (kept here so filteredTenants can be derived)
  const [filterMode, setFilterMode] = useState("period");
  const [filterYA, setFilterYA]     = useState("");
  const [filterYB, setFilterYB]     = useState("");

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [blocksData, maintData] = await Promise.all([fetchBlocks(), fetchMaintenance()]);
        setBlocks(blocksData);
        setMaint(maintData);
      } catch {
        setApiError("Could not reach the server. Make sure the backend is running.");
      } finally {
        setLoading(false);
      }
      try { await verifyToken(); setIsAuthenticated(true); } catch { /* no valid token */ }
    }
    init();
    function onExpired() { setIsAuthenticated(false); }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────
  const allUnits = blocks.flatMap((b) => b.units.map((u) => ({ ...u, blockId: b.bid, blockName: b.name })));
  const allTenants = allUnits.flatMap((u) => u.tenants.map((t) => ({ ...t, unitId: u.uid, unitName: u.name, blockName: u.blockName, monthlyRent: u.monthlyRent })));
  const activeTenants  = allTenants.filter((t) => t.leaseStatus === "active");
  const occupiedUnits  = allUnits.filter((u) => u.tenants.some((t) => t.leaseStatus === "active"));
  const totalRev       = occupiedUnits.reduce((s, u) => { const a = u.tenants.find((t) => t.leaseStatus === "active"); return s + (a ? u.monthlyRent : 0); }, 0);
  const allYears       = [...new Set(allTenants.flatMap((t) => [yr(t.leaseStart), yr(t.leaseEnd), yr(t.cancelDate)]).filter(Boolean))].sort();
  const reminderUnits  = allUnits.filter((u) => { const a = u.tenants.find((t) => t.leaseStatus === "active"); return a && daysUntil(a.leaseEnd) <= 90 && daysUntil(a.leaseEnd) >= -30; });
  const dueSoonCount   = allUnits.filter((u) => { const a = u.tenants.find((t) => t.leaseStatus === "active"); const d = a ? daysUntil(a.leaseEnd) : null; return d !== null && d >= 0 && d <= 30; }).length;
  const overdueCount   = allUnits.filter((u) => { const a = u.tenants.find((t) => t.leaseStatus === "active"); return a && daysUntil(a.leaseEnd) < 0; }).length;

  const filteredTenants = allTenants.filter((t) => {
    if (!filterYA) return true;
    const ya = parseInt(filterYA), yb = filterYB ? parseInt(filterYB) : ya;
    if (filterMode === "period")  { const ts = yr(t.leaseStart), te = yr(t.leaseEnd || t.cancelDate); if (!ts) return false; return ts <= yb && (te === null || te >= ya); }
    if (filterMode === "movein")  return yr(t.leaseStart) >= ya && yr(t.leaseStart) <= yb;
    if (filterMode === "moveout") { const ey = yr(t.cancelDate || t.leaseEnd); return ey && ey >= ya && ey <= yb; }
    return true;
  });

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function endLease(unitId, tid, reason, endDate) {
    const block = await apiUpdateTenant(tid, {
      leaseStatus: "ended",
      cancelReason: reason,
      cancelDate: endDate || today.toISOString().slice(0, 10),
      leaseEnd: endDate || undefined,
    });
    setBlocks((prev) => prev.map((b) => b.bid === block.bid ? block : b));
  }

  async function saveTenant(unitId, updated) {
    const block = await apiUpdateTenant(updated.tid, updated);
    setBlocks((prev) => prev.map((b) => b.bid === block.bid ? block : b));
  }

  async function addTenant(unitId, tenant) {
    const block = await apiAddTenant(unitId, tenant);
    setBlocks((prev) => prev.map((b) => b.bid === block.bid ? block : b));
  }

  async function addUnit(blockId, unit) {
    const block = await apiAddUnit(blockId, unit);
    setBlocks((prev) => prev.map((b) => b.bid === block.bid ? block : b));
  }

  async function deleteUnit(uid) {
    await apiDeleteUnit(uid);
    setBlocks((prev) => prev.map((b) => ({ ...b, units: b.units.filter((u) => u.uid !== uid) })));
  }

  async function deleteBlock(bid) {
    await apiDeleteBlock(bid);
    setBlocks((prev) => prev.filter((b) => b.bid !== bid));
  }

  async function addBlock(block) {
    const created = await createBlock({ name: block.name, type: block.type });
    setBlocks((prev) => [...prev, created]);
  }

  async function saveMaint(entry) {
    const created = await createMaintenance(entry);
    setMaint((prev) => [created, ...prev]);
  }

  async function updMaint(id, status) {
    const updated = await apiUpdateMaintenance(id, { status });
    setMaint((prev) => prev.map((m) => m.id === id ? updated : m));
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────────────
  // Wraps any action: executes immediately if logged in, otherwise shows
  // the PIN overlay and re-fires the action after successful login.
  function withAuth(fn) {
    return (...args) => {
      const run = () => {
        const result = fn(...args);
        if (result?.catch) result.catch(console.error);
      };
      if (isAuthenticated) { run(); }
      else { setPendingFn(() => run); setShowAuthPrompt(true); }
    };
  }
  // Call requireAuth(fn) anywhere to guard a UI action (e.g. opening a modal).
  const requireAuth = (fn) => withAuth(fn)();

  // ── Loading / Error states ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif" }}>
        <LoadingSpinner message="Loading Ivory Crown Homes…" />
      </div>
    );
  }

  if (apiError) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Server Unreachable</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, maxWidth: 380 }}>{apiError}</div>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: C.teal, color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "Georgia,serif", fontWeight: 700 }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Georgia,serif", paddingBottom: 60 }}>

      {/* Step 1 — "You must log in" prompt (shown when user tries to edit without auth) */}
      {showAuthPrompt && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, backdropFilter: "blur(3px)", fontFamily: "Georgia,serif" }}
          onClick={(e) => e.target === e.currentTarget && (setShowAuthPrompt(false), setPendingFn(null))}
        >
          <div style={{ background: "#fffdf9", borderRadius: 18, padding: "36px 40px", maxWidth: 380, width: "90%", boxShadow: "0 12px 60px rgba(0,0,0,0.18)", textAlign: "center" }}>
            <div style={{ fontSize: 38, marginBottom: 14 }}>🔒</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 10 }}>Login Required</div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, marginBottom: 28 }}>
              You need to <strong style={{ color: C.text }}>log in</strong> before you can make any changes.
              Viewing is open to everyone — editing requires a PIN.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => { setShowAuthPrompt(false); setShowLogin(true); }}
                style={{ padding: "10px 26px", borderRadius: 9, border: "none", background: C.teal, color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "Georgia,serif", fontWeight: 700, letterSpacing: 0.3 }}
              >
                Log In
              </button>
              <button
                onClick={() => { setShowAuthPrompt(false); setPendingFn(null); }}
                style={{ padding: "10px 20px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.deep, color: C.muted, cursor: "pointer", fontSize: 13, fontFamily: "Georgia,serif", fontWeight: 600, letterSpacing: 0.3 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — PIN pad overlay */}
      {showLogin && (
        <LoginPage
          onLogin={() => { setIsAuthenticated(true); setShowLogin(false); if (pendingFn) { pendingFn(); setPendingFn(null); } }}
          onCancel={() => { setShowLogin(false); setPendingFn(null); }}
        />
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#fff,#f5f0eb)", borderBottom: `1px solid ${C.border}`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Crown logo */}
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(145deg, ${C.gold}, #b8860b)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,0.15)", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17L5 9L9 13L12 6L15 13L19 9L21 17H3Z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/>
              <rect x="3" y="18" width="18" height="2.5" rx="1.25" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: C.text }}>
              Ivory <span style={{ color: C.teal }}>Crown</span> <span style={{ color: C.gold }}>Homes</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>Property Management System</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right", fontSize: 12, color: C.muted }}>
            <div>{today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            <div style={{ color: C.teal, marginTop: 2, fontWeight: 600 }}>{occupiedUnits.length}/{allUnits.length} Units Occupied</div>
          </div>
          {isAuthenticated ? (
            <button
              onClick={() => { if (window.confirm("Log out of Ivory Crown Homes?")) { apiLogout(); setIsAuthenticated(false); } }}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.deep, color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 600, letterSpacing: 0.3, transition: "background 0.15s, color 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.roseBg; e.currentTarget.style.color = C.rose; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.deep;   e.currentTarget.style.color = C.muted; }}
            >
              Log Out
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${C.teal}88`, background: C.tealBg, color: C.teal, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 600, letterSpacing: 0.3 }}
            >
              Log In
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 2, padding: "0 28px", background: C.surface, borderBottom: `1px solid ${C.border}`, overflowX: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "13px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "Georgia,serif", letterSpacing: 0.4, color: tab === t ? C.teal : C.muted, fontWeight: tab === t ? 700 : 400, borderBottom: tab === t ? `3px solid ${C.teal}` : "3px solid transparent", transition: "all 0.2s", whiteSpace: "nowrap" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        {tab === "Dashboard" && (
          <Dashboard
            totalRev={totalRev}
            occupiedUnits={occupiedUnits}
            allUnits={allUnits}
            blocks={blocks}
            maint={maint}
            dueSoonCount={dueSoonCount}
            overdueCount={overdueCount}
            reminderUnits={reminderUnits}
          />
        )}

        {tab === "Properties" && (
          <Properties
            blocks={blocks}
            requireAuth={requireAuth}
            onEndLease={withAuth(endLease)}
            onSaveTenant={withAuth(saveTenant)}
            onAddTenant={withAuth(addTenant)}
            onAddUnit={withAuth(addUnit)}
            onDeleteUnit={withAuth(deleteUnit)}
            onDeleteBlock={withAuth(deleteBlock)}
            onAddBlock={withAuth(addBlock)}
          />
        )}

        {tab === "Lease Filter" && (
          <LeaseFilter
            allTenants={allTenants}
            filteredTenants={filteredTenants}
            allYears={allYears}
            filterMode={filterMode}
            setFilterMode={setFilterMode}
            filterYA={filterYA}
            setFilterYA={setFilterYA}
            filterYB={filterYB}
            setFilterYB={setFilterYB}
          />
        )}

        {tab === "Reminders" && (
          <Reminders allUnits={allUnits} />
        )}

        {tab === "Maintenance" && (
          <Maintenance
            maint={maint}
            blocks={blocks}
            allUnits={allUnits}
            requireAuth={requireAuth}
            onUpdMaint={withAuth(updMaint)}
            onSaveMaint={withAuth(saveMaint)}
          />
        )}

        {tab === "Security Deposits" && (
          <SecurityDeposits
            allUnits={allUnits}
            occupiedUnits={occupiedUnits}
            activeTenants={activeTenants}
            onSaveTenant={withAuth(saveTenant)}
          />
        )}

        {tab === "Settings" && <Settings />}
      </div>
    </div>
  );
}

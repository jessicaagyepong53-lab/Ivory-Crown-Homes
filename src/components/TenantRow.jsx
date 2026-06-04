import { useState } from "react";
import { uploadDocument, deleteDocument } from "../api/documents.js";
import { renewTenant } from "../api/blocks.js";
import { C } from "../constants/colors";
import { PROF_FIELDS } from "../constants/options";
import { useToast } from "./Toast";
import { iSt, lSt } from "../styles/shared";
import { fmtDate } from "../utils/formatters";
import { yr, monthsAgo, today, getLeaseStatus } from "../utils/helpers";
import Btn from "./ui/Btn";
import Badge from "./ui/Badge";
import Avatar from "./ui/Avatar";
import SLabel from "./ui/SLabel";
import Divider from "./ui/Divider";
import EndLeaseModal from "./EndLeaseModal";
import RenewLeaseModal from "./RenewLeaseModal";
import DocumentVault from "./DocumentVault";

export default function TenantRow({ t, isCurrent, requireAuth, onEndLease, onSave, onRenew }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...t });
  const [showEndModal,   setShowEndModal]   = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [localDocs, setLocalDocs] = useState(t.documents || []);

  const effStatus = getLeaseStatus(t); // 'active' | 'expired' | 'ended' | 'cancelled'
  const isExpired = effStatus === 'expired';

  const sColor = isCurrent
    ? (isExpired ? C.amber  : C.sage)
    : (t.leaseStatus === "cancelled" ? C.rose : C.muted);
  const sBg    = isCurrent
    ? (isExpired ? C.amberBg : C.sageBg)
    : (t.leaseStatus === "cancelled" ? C.roseBg : "#f5f0eb");
  const sLabel = isCurrent
    ? (isExpired ? "Expired" : "Active")
    : (t.leaseStatus === "cancelled" ? "Cancelled" : "Past");

  const dur = (() => {
    const s = new Date(t.leaseStart);
    const e = t.cancelDate ? new Date(t.cancelDate) : t.leaseEnd ? new Date(t.leaseEnd) : today;
    const m = Math.round((e - s) / (30.44 * 86400000));
    if (m < 1) return "<1mo";
    if (m < 12) return `${m}mo`;
    const y = Math.floor(m / 12), r = m % 12;
    return r ? `${y}yr ${r}mo` : `${y}yr`;
  })();

  const leasePeriod = (() => {
    const sy = yr(t.leaseStart), ey = yr(t.leaseEnd || t.cancelDate);
    if (!sy) return "";
    return sy === ey ? `${sy}` : `${sy}–${ey}`;
  })();

  function handleSave() {
    const rent = Number(draft.monthlyRent) || 0;
    const adv  = Number(draft.advanceMonths) || 0;
    const computed = rent > 0 ? { advanceAmount: adv * rent, depositAmount: rent, depositPaid: true } : {};
    onSave({ ...draft, ...computed, balanceOwed: Number(draft.balanceOwed) || 0 });
    setEditing(false);
    toast("Profile saved.", "save");
  }
  function handleEndLease(reason, endDate) { onEndLease(t.tid, reason, endDate); setShowEndModal(false); }
  async function handleRenew(data) {
    try {
      const block = await renewTenant(t.tid, data);
      if (onRenew) onRenew(block);
      toast("Lease renewed successfully.", "lease");
    } catch (e) { console.error(e); toast("Failed to renew lease.", "error"); }
    setShowRenewModal(false);
  }
  async function addDoc(file, cat, note) {
    const result = await uploadDocument(t.tid, file, cat, note);
    setLocalDocs((prev) => [...prev, result]);
    const ex = result._extracted;
    if (ex && Object.keys(ex).length > 0) {
      const lines = [];
      if (ex.monthlyRent)   lines.push(`Monthly Rent: GHS ${Number(ex.monthlyRent).toLocaleString()}`);
      if (ex.advanceMonths) lines.push(`Advance: ${ex.advanceMonths} months`);
      if (ex.advanceAmount) lines.push(`Advance Amount: GHS ${Number(ex.advanceAmount).toLocaleString()}`);
      if (ex.depositAmount) lines.push(`Security Deposit: GHS ${Number(ex.depositAmount).toLocaleString()}`);
      if (ex.leaseStart)    lines.push(`Lease Start: ${ex.leaseStart}`);
      if (ex.leaseEnd)      lines.push(`Lease End: ${ex.leaseEnd}`);
      toast(`📄 Lease details extracted:\n${lines.join(' · ')}`, "upload", 6000);
    } else {
      toast(`"${file.name}" uploaded.`, "upload");
    }
  }
  async function delDoc(did) {
    try {
      await deleteDocument(did);
      setLocalDocs((prev) => prev.filter((d) => d.did !== did));
      toast("Document deleted.", "delete");
    } catch (e) {
      toast("Delete failed — server may be starting up. Try again shortly.", "error");
      console.error("delDoc error:", e);
    }
  }

  function TabBtn({ id, label, count }) {
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{ padding: "7px 16px", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 600, background: activeTab === id ? C.teal : "transparent", color: activeTab === id ? "#fff" : C.muted, borderRadius: "6px 6px 0 0", transition: "all 0.15s" }}
      >
        {label}{count !== undefined && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>({count})</span>}
      </button>
    );
  }

  return (
    <>
      {showEndModal   && <EndLeaseModal   tenantName={t.name} onConfirm={handleEndLease} onClose={() => setShowEndModal(false)} />}
      {showRenewModal && <RenewLeaseModal tenantName={t.name} currentLeaseEnd={t.leaseEnd} currentMonthlyRent={t.monthlyRent} onConfirm={handleRenew} onClose={() => setShowRenewModal(false)} />}

      <div style={{ background: isCurrent ? "#fff" : C.panel, border: `1px solid ${isCurrent ? C.border : C.borderLight}`, borderRadius: 10, marginBottom: 7, overflow: "hidden", boxShadow: isCurrent ? "0 1px 6px rgba(74,157,143,0.08)" : "none" }}>

        {/* Collapsed header */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, cursor: "pointer", minWidth: 0 }} onClick={() => setOpen((o) => !o)}>
            <Avatar name={t.name} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{t.name}</span>
                <Badge label={sLabel} color={sColor} bg={sBg} />
                {leasePeriod && <Badge label={leasePeriod} color={C.lavender} bg={C.lavBg} />}
                {localDocs.length > 0 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setOpen(true); setActiveTab("documents"); }}
                    style={{ cursor: "pointer" }}
                    title="Open Documents"
                  >
                    <Badge label={`📁 ${localDocs.length}`} color={C.sky} bg={C.skyBg} />
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {fmtDate(t.leaseStart)} → {fmtDate(t.leaseEnd || t.cancelDate)} · {dur}
                {!isCurrent && t.cancelDate && <span style={{ color: C.faint }}> · Left {monthsAgo(t.cancelDate)}</span>}
                {(t.leaseStatus === "cancelled" || t.leaseStatus === "ended") && t.cancelReason && <span style={{ color: C.rose + "99" }}> · {t.cancelReason}</span>}
              </div>
            </div>
          </div>

          {isCurrent && (
            <div className="tenant-actions" style={{ display: "flex", gap: 7, flexShrink: 0 }}>
              {isExpired && (
                <button
                  onClick={(e) => { e.stopPropagation(); requireAuth(() => setShowRenewModal(true)); }}
                  style={{ padding: "7px 14px", borderRadius: 8, border: `2px solid ${C.teal}`, background: "#fff", color: C.teal, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700, whiteSpace: "nowrap", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.tealBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  🔄 Renew
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); requireAuth(() => setShowEndModal(true)); }}
                style={{ padding: "7px 14px", borderRadius: 8, border: `2px solid ${C.rose}`, background: "#fff", color: C.rose, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap", transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.roseBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                ✕ End Lease
              </button>
            </div>
          )}
          <span onClick={() => setOpen((o) => !o)} style={{ color: C.muted, fontSize: 15, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0, cursor: "pointer", paddingLeft: 6 }}>⌄</span>
        </div>

        {/* Expanded panel */}
        {open && (
          <div style={{ borderTop: `1px solid ${C.borderLight}`, background: C.deep }}>
            <div style={{ display: "flex", gap: 2, padding: "10px 15px 0", background: C.panel, borderBottom: `1px solid ${C.borderLight}` }}>
              <TabBtn id="profile" label="Profile & Details" />
              <TabBtn id="documents" label="Documents" count={localDocs.length} />
            </div>

            <div style={{ padding: "16px 18px" }}>

              {/* PROFILE TAB */}
              {activeTab === "profile" && (
                !editing ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <SLabel>Tenant Profile</SLabel>
                      <Btn small variant="ghost" onClick={() => requireAuth(() => { setDraft({ ...t }); setEditing(true); })}>✎ Edit Profile</Btn>
                    </div>

                    {/* Name / Phone / Address card + Notes — side by side */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 200px", background: C.tealBg, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: "9px 13px" }}>
                        <div style={{ fontSize: 10, color: C.teal, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 6 }}>Tenant Info</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{t.name}</div>
                        {t.phone   && <div style={{ fontSize: 13, color: C.text, marginBottom: 3 }}>📞 {t.phone}</div>}
                        {t.address && <div style={{ fontSize: 13, color: C.muted }}>📍 {t.address}</div>}
                      </div>

                      {t.notes && (
                        <div style={{ flex: "2 1 220px", background: C.amberBg, border: `1px solid ${C.amber}33`, borderRadius: 8, padding: "9px 13px" }}>
                          <div style={{ fontSize: 10, color: C.amber, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 3 }}>Notes</div>
                          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{t.notes}</div>
                        </div>
                      )}
                    </div>

                    {/* Remaining fields grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: "9px 18px", marginBottom: 12 }}>
                      {[
                        ["Email",   t.email],
                        ["Date of Birth", t.dob ? fmtDate(t.dob) : null],
                        ["Occupation",    t.occupation],
                        ["Employer",      t.employer],
                        ["ID Type",       t.idType],
                        ["ID Number",     t.idNumber],
                        ["Vehicles",      t.vehicles],
                        ["Deposit",       t.depositAmount > 0 ? `${t.depositPaid ? "✓ Paid" : "✗ Pending"} — GHS ${Number(t.depositAmount).toLocaleString()}` : null],
                      ].filter(([, v]) => v).map(([l, v]) => (
                        <div key={l}>
                          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Rent & Financials card */}
                    {(t.monthlyRent > 0 || t.advanceMonths > 0 || t.balanceOwed > 0) && (() => {
                      const rent    = Number(t.monthlyRent)   || 0;
                      const adv     = Number(t.advanceMonths) || 0;
                      const advAmt  = adv * rent;
                      const secDep  = Number(t.depositAmount) || rent;
                      const total   = advAmt + secDep;
                      const balance = Number(t.balanceOwed)   || 0;
                      return (
                        <div style={{ background: C.sageBg, border: `1px solid ${C.sage}33`, borderRadius: 8, padding: "9px 13px", marginBottom: 9 }}>
                          <div style={{ fontSize: 10, color: C.sage, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>Rent & Financials</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "5px 20px", fontSize: 13 }}>
                            <span style={{ color: C.muted }}>Monthly Rent</span>
                            <span style={{ fontWeight: 600, color: C.text, textAlign: "right" }}>GHS {rent.toLocaleString()}/mo</span>
                            {adv > 0 && <><span style={{ color: C.muted }}>Advance Paid ({adv} month{adv !== 1 ? "s" : ""})</span><span style={{ fontWeight: 600, color: C.text, textAlign: "right" }}>GHS {advAmt.toLocaleString()}</span></>}
                            {secDep > 0 && <><span style={{ color: C.muted }}>Security Deposit (1 month)</span><span style={{ fontWeight: 600, color: C.text, textAlign: "right" }}>{t.depositPaid ? "✓ " : "✗ "}GHS {secDep.toLocaleString()}</span></>}
                            {adv > 0 && <>
                              <span style={{ color: C.teal, fontWeight: 700, borderTop: `1px solid ${C.teal}33`, paddingTop: 5 }}>Total Expected</span>
                              <span style={{ color: C.teal, fontWeight: 700, textAlign: "right", borderTop: `1px solid ${C.teal}33`, paddingTop: 5 }}>GHS {total.toLocaleString()}</span>
                            </>}
                            {balance > 0 && <><span style={{ color: C.rose, fontWeight: 700 }}>Balance Owed</span><span style={{ color: C.rose, fontWeight: 700, textAlign: "right" }}>GHS {balance.toLocaleString()}</span></>}
                            {balance > 0 && <><span style={{ color: C.sage, fontWeight: 700 }}>Amount Received</span><span style={{ color: C.sage, fontWeight: 700, textAlign: "right" }}>GHS {(total - balance).toLocaleString()}</span></>}
                            {t.lastPaymentDate && <><span style={{ color: C.muted }}>Last Payment</span><span style={{ color: C.sage, textAlign: "right" }}>GHS {(Number(t.lastPaymentAmount)||0).toLocaleString()} — {t.lastPaymentDate}</span></>}
                          </div>
                        </div>
                      );
                    })()}

                    {(t.emergencyName || t.emergencyPhone) && (
                      <div style={{ background: C.lavBg, border: `1px solid ${C.lavender}33`, borderRadius: 8, padding: "9px 13px", marginBottom: 9 }}>
                        <div style={{ fontSize: 10, color: C.lavender, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 }}>Emergency Contact</div>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{t.emergencyName} <span style={{ color: C.muted, fontWeight: 400 }}>({t.emergencyRelation})</span></div>
                        <div style={{ fontSize: 13, color: C.muted }}>{t.emergencyPhone}</div>
                      </div>
                    )}

                    {!isCurrent && t.cancelReason && (
                      <div style={{ background: C.roseBg, border: `1px solid ${C.rose}33`, borderRadius: 8, padding: "9px 13px", marginTop: 9 }}>
                        <div style={{ fontSize: 10, color: C.rose, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 3 }}>Lease Ended — Reason</div>
                        <div style={{ fontSize: 13, color: C.text }}>{t.cancelReason}</div>
                        {t.cancelDate && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Ended on {fmtDate(t.cancelDate)}</div>}
                      </div>
                    )}

                    {/* Lease renewal history */}
                    {t.leaseHistory?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 10, color: C.lavender, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>📋 Lease History ({t.leaseHistory.length} previous period{t.leaseHistory.length > 1 ? "s" : ""})</div>
                        {[...t.leaseHistory].reverse().map((h, i) => {
                          const sy = h.leaseStart ? new Date(h.leaseStart).getFullYear() : "?";
                          const ey = h.leaseEnd   ? new Date(h.leaseEnd).getFullYear()   : "?";
                          const period = sy === ey ? `${sy}` : `${sy}–${ey}`;
                          const rent   = Number(h.monthlyRent)   || 0;
                          const adv    = Number(h.advanceMonths) || 0;
                          const advAmt = Number(h.advanceAmount) || adv * rent;
                          const dep    = Number(h.depositAmount) || 0;
                          const bal    = Number(h.balanceOwed)   || 0;
                          const lpmAmt = Number(h.lastPaymentAmount) || 0;
                          const histDocs = h.documents || [];
                          return (
                            <div key={i} style={{ background: C.lavBg, border: `1px solid ${C.lavender}22`, borderRadius: 7, padding: "10px 12px", marginBottom: 6, fontSize: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                                <span style={{ fontWeight: 700, color: C.lavender }}>{period}</span>
                                <span style={{ color: C.muted }}>{fmtDate(h.leaseStart)} → {fmtDate(h.leaseEnd)}</span>
                                {h.renewedAt && <span style={{ color: C.faint, fontSize: 11, marginLeft: "auto" }}>Renewed {fmtDate(h.renewedAt)}</span>}
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "3px 12px", color: C.muted }}>
                                {rent > 0  && <span>Rent: <b style={{ color: C.text }}>GHS {rent.toLocaleString()}/mo</b></span>}
                                {adv > 0   && <span>Advance: <b style={{ color: C.text }}>{adv} mo</b></span>}
                                {advAmt > 0 && <span>Advance Paid: <b style={{ color: C.text }}>GHS {advAmt.toLocaleString()}</b></span>}
                                {dep > 0   && <span>Deposit: <b style={{ color: C.text }}>{h.depositPaid ? "✓ " : "✗ "}GHS {dep.toLocaleString()}</b></span>}
                                {bal > 0   && <span>Balance Owed: <b style={{ color: C.rose }}>GHS {bal.toLocaleString()}</b></span>}
                                {lpmAmt > 0 && h.lastPaymentDate && <span>Last Payment: <b style={{ color: C.sage }}>GHS {lpmAmt.toLocaleString()} on {h.lastPaymentDate}</b></span>}
                              </div>
                              {histDocs.length > 0 && (
                                <div style={{ marginTop: 8, borderTop: `1px solid ${C.lavender}22`, paddingTop: 7 }}>
                                  <div style={{ fontSize: 10, color: C.teal, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5, fontWeight: 600 }}>📁 Documents ({histDocs.length})</div>
                                  {histDocs.map((doc) => (
                                    <div key={doc.did} style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>
                                      <span style={{ fontSize: 13, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: C.text }}>{doc.name}</span>
                                      {doc.category && <span style={{ fontSize: 10, color: C.muted }}>{doc.category}</span>}
                                      {doc.did && (
                                        <>
                                          <button
                                            onClick={() => {
                                              const token = localStorage.getItem("estatepro_token") || "";
                                              const base  = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
                                              window.open(`${base}/api/documents/${doc.did}/file?token=${encodeURIComponent(token)}`, "_blank");
                                            }}
                                            style={{ padding: "3px 8px", border: `1px solid ${C.teal}`, background: C.tealBg, color: C.teal, borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "Georgia,serif", whiteSpace: "nowrap" }}
                                          >View</button>
                                          <a
                                            href={`${(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "")}/api/documents/${doc.did}/file?dl=1&token=${encodeURIComponent(localStorage.getItem("estatepro_token") || "")}`}
                                            download={doc.name}
                                            style={{ padding: "3px 8px", border: `1px solid ${C.border}`, background: C.deep, color: C.muted, borderRadius: 5, fontSize: 11, textDecoration: "none", fontFamily: "Georgia,serif", whiteSpace: "nowrap" }}
                                          >↓</a>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <SLabel>Edit Profile</SLabel>
                    <div className="tenant-edit-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                      {PROF_FIELDS.map((f) => (
                        <div key={f.key}>
                          <label style={lSt}>{f.label}</label>
                          <input type={f.type || "text"} style={iSt} value={draft[f.key] || ""} onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))} />
                        </div>
                      ))}
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lSt}>Notes</label>
                        <textarea style={{ ...iSt, resize: "vertical", minHeight: 60 }} value={draft.notes || ""} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} />
                      </div>
                    </div>

                    {/* Rent & Financials */}
                    <Divider />
                    <SLabel>Rent & Financials</SLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 8 }}>
                      <div>
                        <label style={lSt}>Monthly Rent (GHS)</label>
                        <input type="number" min="0" style={iSt} value={draft.monthlyRent || ""} onChange={(e) => setDraft((p) => ({ ...p, monthlyRent: e.target.value }))} />
                      </div>
                      <div>
                        <label style={lSt}>Months Advance Paid</label>
                        <input type="number" min="0" style={iSt} value={draft.advanceMonths || ""} onChange={(e) => setDraft((p) => ({ ...p, advanceMonths: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lSt}>Balance Still Owed (GHS) <span style={{ color: C.faint, fontWeight: 400 }}>— 0 if fully paid</span></label>
                        <input type="number" min="0" style={iSt} value={draft.balanceOwed || ""} onChange={(e) => setDraft((p) => ({ ...p, balanceOwed: e.target.value }))} placeholder="0" />
                      </div>
                    </div>
                    {Number(draft.monthlyRent) > 0 && (() => {
                      const rent   = Number(draft.monthlyRent);
                      const adv    = Number(draft.advanceMonths) || 0;
                      const advAmt = adv * rent;
                      const total  = advAmt + rent;
                      return (
                        <div style={{ background: C.tealBg, border: `1px solid ${C.teal}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Calculation Preview</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px", fontSize: 13, color: C.text }}>
                            <span style={{ color: C.muted }}>Advance ({adv} month{adv !== 1 ? "s" : ""} × GHS {rent.toLocaleString()})</span>
                            <span style={{ fontWeight: 600, textAlign: "right" }}>GHS {advAmt.toLocaleString()}</span>
                            <span style={{ color: C.muted }}>Security Deposit (1 month — auto)</span>
                            <span style={{ fontWeight: 600, textAlign: "right" }}>GHS {rent.toLocaleString()}</span>
                            <span style={{ color: C.teal, fontWeight: 700, borderTop: `1px solid ${C.teal}44`, paddingTop: 4 }}>Total Received</span>
                            <span style={{ color: C.teal, fontWeight: 700, textAlign: "right", borderTop: `1px solid ${C.teal}44`, paddingTop: 4 }}>GHS {total.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ display: "flex", gap: 7, marginTop: 12, justifyContent: "flex-end" }}>
                      <Btn small variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
                      <Btn small onClick={handleSave}>Save Changes</Btn>
                    </div>
                  </>
                )
              )}

              {/* DOCUMENTS TAB */}
              {activeTab === "documents" && (
                <DocumentVault docs={localDocs} onAdd={addDoc} onDelete={delDoc} requireAuth={requireAuth} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

import { useState } from "react";
import { uploadDocument, deleteDocument } from "../api/documents.js";
import { C } from "../constants/colors";
import { PROF_FIELDS } from "../constants/options";
import { iSt, lSt } from "../styles/shared";
import { fmtDate } from "../utils/formatters";
import { yr, monthsAgo, today } from "../utils/helpers";
import Btn from "./ui/Btn";
import Badge from "./ui/Badge";
import Avatar from "./ui/Avatar";
import SLabel from "./ui/SLabel";
import Divider from "./ui/Divider";
import EndLeaseModal from "./EndLeaseModal";
import DocumentVault from "./DocumentVault";

export default function TenantRow({ t, isCurrent, requireAuth, onEndLease, onSave }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...t });
  const [showEndModal, setShowEndModal] = useState(false);

  const sColor = isCurrent ? C.sage : t.leaseStatus === "cancelled" ? C.rose : C.muted;
  const sBg    = isCurrent ? C.sageBg : t.leaseStatus === "cancelled" ? C.roseBg : "#f5f0eb";
  const sLabel = isCurrent ? "Active" : t.leaseStatus === "cancelled" ? "Cancelled" : "Past";

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

  function handleSave() { onSave({ ...draft }); setEditing(false); }
  function handleEndLease(reason, endDate) { onEndLease(t.tid, reason, endDate); setShowEndModal(false); }
  async function addDoc(file, cat, note) {
    const newDoc = await uploadDocument(t.tid, file, cat, note);
    onSave({ ...t, documents: [...(t.documents || []), newDoc] });
  }
  async function delDoc(did) {
    await deleteDocument(did);
    onSave({ ...t, documents: (t.documents || []).filter((d) => d.did !== did) });
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
      {showEndModal && <EndLeaseModal tenantName={t.name} onConfirm={handleEndLease} onClose={() => setShowEndModal(false)} />}

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
                {(t.documents || []).length > 0 && <Badge label={`📁 ${t.documents.length}`} color={C.sky} bg={C.skyBg} />}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {fmtDate(t.leaseStart)} → {fmtDate(t.leaseEnd || t.cancelDate)} · {dur}
                {!isCurrent && t.cancelDate && <span style={{ color: C.faint }}> · Left {monthsAgo(t.cancelDate)}</span>}
                {(t.leaseStatus === "cancelled" || t.leaseStatus === "ended") && t.cancelReason && <span style={{ color: C.rose + "99" }}> · {t.cancelReason}</span>}
              </div>
            </div>
          </div>

          {isCurrent && (
            <button
              onClick={(e) => { e.stopPropagation(); requireAuth(() => setShowEndModal(true)); }}
              style={{ padding: "7px 14px", borderRadius: 8, border: `2px solid ${C.rose}`, background: "#fff", color: C.rose, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700, letterSpacing: 0.3, flexShrink: 0, whiteSpace: "nowrap", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.roseBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              ✕ End Lease
            </button>
          )}
          <span onClick={() => setOpen((o) => !o)} style={{ color: C.muted, fontSize: 15, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0, cursor: "pointer", paddingLeft: 6 }}>⌄</span>
        </div>

        {/* Expanded panel */}
        {open && (
          <div style={{ borderTop: `1px solid ${C.borderLight}`, background: C.deep }}>
            <div style={{ display: "flex", gap: 2, padding: "10px 15px 0", background: C.panel, borderBottom: `1px solid ${C.borderLight}` }}>
              <TabBtn id="profile" label="Profile & Details" />
              <TabBtn id="documents" label="Documents" count={(t.documents || []).length} />
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

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: "9px 18px", marginBottom: 12 }}>
                      {[
                        ["Phone",   t.phone],
                        ["Email",   t.email],
                        ["Date of Birth", t.dob ? fmtDate(t.dob) : null],
                        ["Occupation",    t.occupation],
                        ["Employer",      t.employer],
                        ["ID Type",       t.idType],
                        ["ID Number",     t.idNumber],
                        ["Vehicles",      t.vehicles],
                        ["Deposit",       t.depositAmount != null ? `${t.depositPaid ? "✓ Paid" : "✗ Pending"} — GHS ${Number(t.depositAmount).toLocaleString()}` : (t.depositPaid ? "✓ Paid" : "✗ Pending")],
                      ].filter(([, v]) => v).map(([l, v]) => (
                        <div key={l}>
                          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {(t.emergencyName || t.emergencyPhone) && (
                      <div style={{ background: C.lavBg, border: `1px solid ${C.lavender}33`, borderRadius: 8, padding: "9px 13px", marginBottom: 9 }}>
                        <div style={{ fontSize: 10, color: C.lavender, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 }}>Emergency Contact</div>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{t.emergencyName} <span style={{ color: C.muted, fontWeight: 400 }}>({t.emergencyRelation})</span></div>
                        <div style={{ fontSize: 13, color: C.muted }}>{t.emergencyPhone}</div>
                      </div>
                    )}

                    {t.notes && (
                      <div style={{ background: C.amberBg, border: `1px solid ${C.amber}33`, borderRadius: 8, padding: "9px 13px" }}>
                        <div style={{ fontSize: 10, color: C.amber, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 3 }}>Notes</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{t.notes}</div>
                      </div>
                    )}

                    {!isCurrent && t.cancelReason && (
                      <div style={{ background: C.roseBg, border: `1px solid ${C.rose}33`, borderRadius: 8, padding: "9px 13px", marginTop: 9 }}>
                        <div style={{ fontSize: 10, color: C.rose, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 3 }}>Lease Ended — Reason</div>
                        <div style={{ fontSize: 13, color: C.text }}>{t.cancelReason}</div>
                        {t.cancelDate && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Ended on {fmtDate(t.cancelDate)}</div>}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <SLabel>Edit Profile</SLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
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
                    <div style={{ display: "flex", gap: 7, marginTop: 12, justifyContent: "flex-end" }}>
                      <Btn small variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
                      <Btn small onClick={handleSave}>Save Changes</Btn>
                    </div>
                  </>
                )
              )}

              {/* DOCUMENTS TAB */}
              {activeTab === "documents" && (
                <DocumentVault docs={t.documents || []} onAdd={addDoc} onDelete={delDoc} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

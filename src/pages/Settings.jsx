import { useState, useEffect } from "react";
import { C } from "../constants/colors";
import { changePin, getSecurityQuestion, setSecurityQuestion } from "../api/auth.js";
import { fetchTrash, restoreTrashItem, bulkRestoreTrash, deleteTrashItem, bulkDeleteTrash } from "../api/trash.js";
import { iSt, lSt, card } from "../styles/shared";
import Btn from "../components/ui/Btn";
import Badge from "../components/ui/Badge";

const TYPE_META = {
  block:  { icon: "🏢", label: "Block",  color: "#5b8dee", bg: "#eef2fd" },
  unit:   { icon: "🚪", label: "Unit",   color: "#4a9d8f", bg: "#e8f7f5" },
  tenant: { icon: "👤", label: "Tenant", color: "#9b7ec8", bg: "#f2edfb" },
};

function daysLeft(expiresAt) {
  return Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / 86400000));
}

function DaysLeftBadge({ expiresAt }) {
  const d = daysLeft(expiresAt);
  const color = d > 14 ? C.sage : d > 7 ? C.amber : C.rose;
  const bg    = d > 14 ? C.sageBg : d > 7 ? C.amberBg : C.roseBg;
  return <Badge label={`${d}d left`} color={color} bg={bg} />;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Settings({ requireAuth, isAuthenticated }) {
  const [newPin,     setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error,      setError]      = useState("");
  const [saved,      setSaved]      = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Security question state
  const [currentQuestion, setCurrentQuestion] = useState(null); // null = not loaded/none set
  const [qLoading,   setQLoading]   = useState(true);
  const [qQuestion,  setQQuestion]  = useState("");
  const [qAnswer,    setQAnswer]    = useState("");
  const [qError,     setQError]     = useState("");
  const [qSaved,     setQSaved]     = useState(false);
  const [qSaving,    setQSaving]    = useState(false);

  // Trash state
  const [trash,        setTrash]        = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [trashMsg,     setTrashMsg]     = useState(null); // { text, ok }
  const [typeFilter,   setTypeFilter]   = useState("all");

  async function loadTrash() {
    setTrashLoading(true);
    try { setTrash(await fetchTrash()); } catch { /* not authenticated or empty */ }
    finally { setTrashLoading(false); }
  }

  async function loadSecurityQuestion() {
    setQLoading(true);
    try {
      const { question } = await getSecurityQuestion();
      setCurrentQuestion(question);
    } catch {
      setCurrentQuestion(""); // none configured yet
    } finally {
      setQLoading(false);
    }
  }

  useEffect(() => { if (isAuthenticated) loadTrash(); }, [isAuthenticated]);
  useEffect(() => { loadSecurityQuestion(); }, []);

  async function handleSave() {
    setError("");
    setSaved(false);
    if (!/^\d{4,8}$/.test(newPin)) { setError("PIN must be 4–8 digits (numbers only)."); return; }
    if (newPin !== confirmPin)      { setError("PINs do not match — please re-enter."); return; }
    setSaving(true);
    try {
      await changePin(newPin);
      setSaved(true);
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => setSaved(false), 5000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update PIN. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveQuestion() {
    setQError("");
    setQSaved(false);
    if (!qQuestion.trim()) { setQError("Enter a question."); return; }
    if (!qAnswer.trim())   { setQError("Enter an answer."); return; }
    setQSaving(true);
    try {
      await setSecurityQuestion(qQuestion.trim(), qAnswer.trim());
      setQSaved(true);
      setCurrentQuestion(qQuestion.trim());
      setQQuestion("");
      setQAnswer("");
      setTimeout(() => setQSaved(false), 5000);
    } catch (err) {
      setQError(err.response?.data?.error || "Failed to save security question. Please try again.");
    } finally {
      setQSaving(false);
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const visibleTrash = typeFilter === "all" ? trash : trash.filter(i => i.type === typeFilter);

  function toggleAll() {
    const visibleIds = visibleTrash.map(i => i._id);
    const allSelected = visibleIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  }

  async function doRestore(ids) {
    try {
      if (ids.length === 1) await restoreTrashItem(ids[0]);
      else await bulkRestoreTrash(ids);
      setTrashMsg({ text: `✓ Restored ${ids.length} item${ids.length > 1 ? "s" : ""} successfully.`, ok: true });
      setSelected(new Set());
      await loadTrash();
    } catch (err) {
      setTrashMsg({ text: err.response?.data?.error || "Restore failed — parent may no longer exist.", ok: false });
    }
    setTimeout(() => setTrashMsg(null), 5000);
  }

  async function doDelete(ids) {
    if (!window.confirm(`Permanently delete ${ids.length} item${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    try {
      if (ids.length === 1) await deleteTrashItem(ids[0]);
      else await bulkDeleteTrash(ids);
      setTrashMsg({ text: `Permanently deleted ${ids.length} item${ids.length > 1 ? "s" : ""}.`, ok: true });
      setSelected(new Set());
      await loadTrash();
    } catch {
      setTrashMsg({ text: "Delete failed.", ok: false });
    }
    setTimeout(() => setTrashMsg(null), 5000);
  }

  const selectedIds = [...selected].filter(id => visibleTrash.some(i => i._id === id));
  const allVisibleSelected = visibleTrash.length > 0 && visibleTrash.every(i => selected.has(i._id));

  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Settings</div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>Manage your application preferences.</p>

      {/* PIN change card */}
      <div className="app-card" style={{ ...card, maxWidth: 500 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
          🔑 Change Access PIN
        </div>

        {isAuthenticated ? (
          <>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 6, lineHeight: 1.7 }}>
              Set a new PIN (4–8 digits) for this session's login.
            </p>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 22, background: C.panel, borderRadius: 8, padding: "8px 12px", display: "inline-block" }}>
              PIN is stored securely on the server (bcrypt hashed).
            </div>

            <div className="pin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div>
                <label style={lSt}>New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  style={iSt}
                  placeholder="4–8 digits"
                  value={newPin}
                  onChange={(e) => { setSaved(false); setError(""); setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8)); }}
                />
              </div>
              <div>
                <label style={lSt}>Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  style={iSt}
                  placeholder="Re-enter new PIN"
                  value={confirmPin}
                  onChange={(e) => { setSaved(false); setError(""); setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8)); }}
                />
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: C.rose, fontWeight: 600, marginBottom: 14, padding: "8px 12px", background: C.roseBg, borderRadius: 7, border: `1px solid ${C.rose}33` }}>
                {error}
              </div>
            )}
            {saved && (
              <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, marginBottom: 14, padding: "8px 12px", background: C.sageBg, borderRadius: 7, border: `1px solid ${C.sage}33` }}>
                ✓ PIN updated successfully. Use your new PIN next time you log in.
              </div>
            )}

            <Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save New PIN"}</Btn>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 18 }}>
              You need to be logged in to change your PIN.
              <br />
              Forgotten it entirely? Use <strong style={{ color: C.text }}>"Forgot PIN?"</strong> on the login screen — it uses your security question instead.
            </p>
            <Btn onClick={() => requireAuth(() => {})}>Log In</Btn>
          </div>
        )}
      </div>

      {/* Security question card */}
      <div className="app-card" style={{ ...card, maxWidth: 500, marginTop: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
          🛟 PIN Recovery — Security Question
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.7 }}>
          Set this up now so you can reset your PIN yourself if you ever forget it, without anyone needing to touch the database.
        </p>

        {!qLoading && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, background: C.panel, borderRadius: 8, padding: "8px 12px" }}>
            {currentQuestion
              ? <>Current question: <b style={{ color: C.text }}>{currentQuestion}</b></>
              : <span style={{ color: C.rose }}>No recovery question set yet — PIN reset is unavailable until you set one.</span>}
          </div>
        )}

        {isAuthenticated ? (
          <>
            <div style={{ marginBottom: 13 }}>
              <label style={lSt}>{currentQuestion ? "New Question" : "Question"}</label>
              <input
                type="text"
                style={iSt}
                placeholder="e.g. What street did you grow up on?"
                value={qQuestion}
                onChange={(e) => { setQSaved(false); setQError(""); setQQuestion(e.target.value); }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lSt}>Answer</label>
              <input
                type="text"
                style={iSt}
                placeholder="Answer (not case-sensitive)"
                value={qAnswer}
                onChange={(e) => { setQSaved(false); setQError(""); setQAnswer(e.target.value); }}
              />
            </div>

            {qError && (
              <div style={{ fontSize: 12, color: C.rose, fontWeight: 600, marginBottom: 14, padding: "8px 12px", background: C.roseBg, borderRadius: 7, border: `1px solid ${C.rose}33` }}>
                {qError}
              </div>
            )}
            {qSaved && (
              <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, marginBottom: 14, padding: "8px 12px", background: C.sageBg, borderRadius: 7, border: `1px solid ${C.sage}33` }}>
                ✓ Security question saved.
              </div>
            )}

            <Btn onClick={handleSaveQuestion} disabled={qSaving}>{qSaving ? "Saving…" : (currentQuestion ? "Update Question" : "Set Question")}</Btn>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "10px 10px 4px" }}>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Log in to set or change your recovery question.</p>
            <Btn onClick={() => requireAuth(() => {})}>Log In</Btn>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="app-card" style={{ ...card, maxWidth: 500, marginTop: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.lavender, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>
          ℹ How PIN Protection Works
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {[
            ["👁  View", "Anyone can browse the dashboard, properties, and all data without a PIN."],
            ["✏  Edit",  "Adding tenants, ending leases, logging maintenance, and any data change requires a PIN login."],
            ["🔒 Session", "Once logged in, edits are unlocked for the current session. Closing or refreshing the page resets this."],
            ["🚫 Lockout", "3 incorrect PIN attempts locks login for 15 minutes. A second lockout locks it for a full 24 hours. Security-question attempts always lock for just 15 minutes, so PIN recovery stays available."],
            ["⚙  Reset",  "Forgotten your PIN? Use \"Forgot PIN?\" on the login screen and answer your security question."],
          ].map(([label, text]) => (
            <div key={label} className="settings-info-item" style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: C.muted, minWidth: 90 }}>{label}</span>
              <span style={{ color: C.text }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trash Bin ──────────────────────────────────────────────────────── */}
      <div className="app-card" style={{ ...card, marginTop: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🗑</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.rose, letterSpacing: 1.2, textTransform: "uppercase" }}>Trash Bin</div>
              <div style={{ fontSize: 12, color: C.muted }}>Deleted items are kept for 30 days then automatically removed.</div>
            </div>
          </div>
          <div className="trash-filters" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", "block", "unit", "tenant"].map(f => (
              <button key={f} onClick={() => setTypeFilter(f)} style={{ padding: "5px 13px", borderRadius: 16, border: `1px solid ${typeFilter === f ? C.teal : C.border}`, background: typeFilter === f ? C.tealBg : C.deep, color: typeFilter === f ? C.teal : C.muted, cursor: "pointer", fontSize: 11, fontFamily: "Georgia,serif", fontWeight: 600, textTransform: "capitalize" }}>
                {f === "all" ? `All (${trash.length})` : `${TYPE_META[f].icon} ${TYPE_META[f].label}s (${trash.filter(i => i.type === f).length})`}
              </button>
            ))}
          </div>
        </div>

        {!isAuthenticated ? (
          <div style={{ textAlign: "center", padding: "28px 16px", fontSize: 13, color: C.muted }}>
            🔒 Log in to view and manage trash.
          </div>
        ) : trashLoading ? (
          <div style={{ textAlign: "center", padding: "28px 16px", fontSize: 13, color: C.muted }}>Loading…</div>
        ) : (
          <>
            {/* Feedback message */}
            {trashMsg && (
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, padding: "8px 12px", borderRadius: 7, background: trashMsg.ok ? C.sageBg : C.roseBg, color: trashMsg.ok ? C.sage : C.rose, border: `1px solid ${(trashMsg.ok ? C.sage : C.rose)}33` }}>
                {trashMsg.text}
              </div>
            )}

            {/* Bulk action bar */}
            {selectedIds.length > 0 && (
              <div className="bulk-actions" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.tealBg, border: `1px solid ${C.teal}44`, borderRadius: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.teal, flex: 1 }}>{selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected</span>
                <button
                  onClick={() => requireAuth(() => doRestore(selectedIds))}
                  style={{ padding: "6px 16px", borderRadius: 7, border: `1px solid ${C.teal}`, background: C.teal, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700 }}
                >
                  ↩ Restore Selected ({selectedIds.length})
                </button>
                <button
                  onClick={() => requireAuth(() => doDelete(selectedIds))}
                  style={{ padding: "6px 16px", borderRadius: 7, border: `1px solid ${C.rose}`, background: C.rose, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700 }}
                >
                  🗑 Delete Permanently ({selectedIds.length})
                </button>
              </div>
            )}

            {visibleTrash.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 13, color: C.muted }}>Trash is empty.</div>
              </div>
            ) : (
              <div className="tbl-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.borderLight}` }}>
                      <th style={{ padding: "8px 10px", width: 36 }}>
                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} style={{ cursor: "pointer" }} />
                      </th>
                      {["Type", "Name", "Context", "Deleted", "Expires", ""].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "Georgia,serif" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTrash.map(item => {
                      const meta = TYPE_META[item.type] || TYPE_META.unit;
                      const isSelected = selected.has(item._id);
                      return (
                        <tr key={item._id} style={{ borderBottom: `1px solid ${C.borderLight}`, background: isSelected ? C.tealBg + "55" : "transparent", transition: "background 0.1s" }}>
                          <td style={{ padding: "10px 10px" }}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item._id)} style={{ cursor: "pointer" }} />
                          </td>
                          <td style={{ padding: "10px 10px" }}>
                            <Badge label={`${meta.icon} ${meta.label}`} color={meta.color} bg={meta.bg} />
                          </td>
                          <td style={{ padding: "10px 10px", fontWeight: 700, fontSize: 13, color: C.text }}>{item.label}</td>
                          <td style={{ padding: "10px 10px", fontSize: 12, color: C.muted }}>{item.context || "—"}</td>
                          <td style={{ padding: "10px 10px", fontSize: 12, color: C.muted }}>{fmtDate(item.deletedAt)}</td>
                          <td style={{ padding: "10px 10px" }}><DaysLeftBadge expiresAt={item.expiresAt} /></td>
                          <td style={{ padding: "10px 10px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => requireAuth(() => doRestore([item._id]))}
                                title="Restore"
                                style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.teal}`, background: "#fff", color: C.teal, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700 }}
                              >
                                ↩ Restore
                              </button>
                              <button
                                onClick={() => requireAuth(() => doDelete([item._id]))}
                                title="Delete permanently"
                                style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.rose}44`, background: "#fff", color: C.rose, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700 }}
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
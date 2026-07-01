import { useEffect, useState } from "react";
import { C } from "../constants/colors";
import { iSt, lSt, card, th, td, sGrid } from "../styles/shared";
import { fmt, fmtDate } from "../utils/formatters";
import { today } from "../utils/helpers";
import Btn from "../components/ui/Btn";
import Badge from "../components/ui/Badge";
import { MAINT_TYPES, MAINT_STATUS } from "../constants/options";
import { maintenanceAttachmentUrl, parseMaintenanceReceiptUpload } from "../api/maintenance";

const STATUS_COLORS = {
  "Pending":     [C.amber, C.amberBg],
  "In Progress": [C.sky,   C.skyBg],
  "Completed":   [C.sage,  C.sageBg],
  "Cancelled":   [C.muted, "#f5f0eb"],
};

const NEW_DRAFT_KEY = "maintenance:new-draft";
const EDIT_DRAFT_PREFIX = "maintenance:edit-draft:";

function readDraft(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function stripTransientFields(data) {
  const { attachmentsFiles, receiptBreakdown, ...rest } = data || {};
  return rest;
}

export default function Maintenance({ maint, blocks, allUnits, requireAuth, onUpdMaint, onSaveMaint, onDeleteAttachment, onEditMaint, onDeleteMaint }) {
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [showEditMaint, setShowEditMaint] = useState(false);
  const [newMaint, setNewMaint] = useState(() => ({
    scopeMode: "unit",
    targetScope: "unit",
    blockId: "",
    blockIds: [],
    unitId: "",
    commonAreaName: "",
    type: "General",
    description: "",
    issueDate: today.toISOString().slice(0, 10),
    scheduledDate: "",
    cost: "",
    contractor: "",
    contractorContact: "",
    location: "",
    unitsCovered: "",
    receiptBreakdown: null,
    attachmentsFiles: [],
    ...readDraft(NEW_DRAFT_KEY, {}),
  }));
  const [editMaint, setEditMaint] = useState({ id: "", scopeMode: "unit", targetScope: "unit", blockId: "", blockIds: [], unitId: "", commonAreaName: "", type: "General", description: "", issueDate: "", scheduledDate: "", cost: "", contractor: "", contractorContact: "", location: "", unitsCovered: "" });
  const [saveError, setSaveError] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isParsingReceipt, setIsParsingReceipt] = useState(false);
  const [deletingAttachmentKey, setDeletingAttachmentKey] = useState("");
  const [deletingEntryId, setDeletingEntryId] = useState("");
  const [attachmentViewer, setAttachmentViewer] = useState(null);

  useEffect(() => {
    if (!showAddMaint) return;
    localStorage.setItem(NEW_DRAFT_KEY, JSON.stringify(stripTransientFields(newMaint)));
  }, [newMaint, showAddMaint]);

  useEffect(() => {
    if (!showEditMaint || !editMaint.id) return;
    localStorage.setItem(EDIT_DRAFT_PREFIX + editMaint.id, JSON.stringify(stripTransientFields(editMaint)));
  }, [editMaint, showEditMaint]);

  function clearNewDraft() {
    localStorage.removeItem(NEW_DRAFT_KEY);
  }

  function clearEditDraft(id) {
    localStorage.removeItem(EDIT_DRAFT_PREFIX + id);
  }

  function openAddMaint() {
    const draft = readDraft(NEW_DRAFT_KEY, null);
    if (draft) {
      setNewMaint((prev) => ({
        ...prev,
        ...draft,
        blockIds: Array.isArray(draft.blockIds) ? draft.blockIds : [],
        attachmentsFiles: prev.attachmentsFiles || [],
      }));
    }
    setShowAddMaint(true);
  }

  async function handleSaveMaint() {
    setSaveError("");
    const selectedBlockIds = Array.isArray(newMaint.blockIds) && newMaint.blockIds.length > 0
      ? newMaint.blockIds
      : (newMaint.blockId ? [newMaint.blockId] : []);
    const selectedBlocks = blocks.filter((b) => selectedBlockIds.includes(String(b.bid)));
    const block = selectedBlocks[0] || blocks.find((b) => String(b.bid) === String(newMaint.blockId));
    const unit = allUnits.find((u) => String(u.uid) === String(newMaint.unitId));
    if (selectedBlocks.length === 0 || !newMaint.description.trim()) {
      setSaveError("Please select a block and enter a description.");
      return;
    }
    if (newMaint.scopeMode === "unit" && !unit) {
      setSaveError("Please select a unit, or switch this request to block/common area.");
      return;
    }
    if (newMaint.scopeMode === "block" && !newMaint.commonAreaName.trim()) {
      setSaveError("Please enter the common area name (for example Gate, Staircase, Water Tank).");
      return;
    }
    const isAllUnits = newMaint.scopeMode === "allBlock";
    const commonAreaName = isAllUnits ? "All Units" : newMaint.commonAreaName.trim();

    const payload = {
      ...newMaint,
      blockId: block?.bid || "",
      blockIds: selectedBlockIds,
      targetScope: newMaint.scopeMode === "unit" ? "unit" : "block",
      commonAreaName,
      label: newMaint.scopeMode === "unit"
        ? `${unit.blockName} / ${unit.name}`
        : `${selectedBlocks.map((b) => b.name).join(" + ")} / ${commonAreaName}`,
      reportedDate: newMaint.issueDate || today.toISOString().slice(0, 10),
      status: "Pending",
      cost: Number(newMaint.cost) || 0,
      unitsCovered: Number(newMaint.unitsCovered) || 0,
    };

    try {
      setIsSaving(true);
      await onSaveMaint(payload);
      clearNewDraft();
      setNewMaint({ scopeMode: "unit", targetScope: "unit", blockId: "", blockIds: [], unitId: "", commonAreaName: "", type: "General", description: "", issueDate: today.toISOString().slice(0, 10), scheduledDate: "", cost: "", contractor: "", contractorContact: "", location: "", unitsCovered: "", receiptBreakdown: null, attachmentsFiles: [] });
      setShowAddMaint(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleParseReceipt() {
    setSaveError("");
    const file = newMaint.attachmentsFiles?.[0];
    if (!file) {
      setSaveError("Attach a receipt/document first, then click Auto-fill from Receipt.");
      return;
    }

    try {
      setIsParsingReceipt(true);
      const parsed = await parseMaintenanceReceiptUpload(file);
      setNewMaint((prev) => {
        const nextDescription = prev.description.trim()
          ? prev.description
          : (parsed.summaryDescription || prev.description);
        return {
          ...prev,
          description: nextDescription,
          contractor: prev.contractor || parsed.vendor || "",
          contractorContact: prev.contractorContact || parsed.contractorContact || "",
          location: prev.location || parsed.location || "",
          issueDate: parsed.issueDate || prev.issueDate,
          cost: (Number(prev.cost) > 0 ? prev.cost : (parsed.grandTotal || prev.cost)),
          receiptBreakdown: {
            vendor: parsed.vendor || "",
            issueDate: parsed.issueDate || "",
            materialsTotal: parsed.materialsTotal || 0,
            labourTotal: parsed.labourTotal || 0,
            grandTotal: parsed.grandTotal || 0,
            items: parsed.items || [],
          },
        };
      });
    } catch {
      setSaveError("Could not parse this file automatically. You can still fill the fields manually.");
    } finally {
      setIsParsingReceipt(false);
    }
  }

  async function handleDeleteAttachment(entryId, attachmentId) {
    if (!onDeleteAttachment) return;
    if (!window.confirm("Delete this receipt/document?")) return;
    const key = `${entryId}:${attachmentId}`;
    setDeletingAttachmentKey(key);
    try {
      await onDeleteAttachment(entryId, attachmentId);
    } finally {
      setDeletingAttachmentKey("");
    }
  }

  async function handleDeleteMaint(entryId) {
    if (!onDeleteMaint) return;
    if (!window.confirm("Delete this maintenance entry? This cannot be undone.")) return;
    setDeletingEntryId(entryId);
    try {
      await onDeleteMaint(entryId);
    } finally {
      setDeletingEntryId("");
    }
  }

  function openEditModal(entry) {
    setEditError("");
    const draft = readDraft(EDIT_DRAFT_PREFIX + entry.id, null);
    setEditMaint(draft ? {
      ...draft,
      id: entry.id,
      blockIds: Array.isArray(draft.blockIds) && draft.blockIds.length > 0
        ? draft.blockIds
        : (entry.blockIds || (entry.blockId ? [entry.blockId] : [])),
      blockId: draft.blockId || entry.blockId || "",
      unitId: draft.unitId || entry.unitId || "",
      scopeMode: draft.scopeMode || (entry.targetScope === "unit" ? "unit" : ((entry.commonAreaName || "").toLowerCase() === "all units" ? "allBlock" : "block")),
      targetScope: draft.targetScope || entry.targetScope || (entry.unitId ? "unit" : "block"),
    } : {
      id: entry.id,
      scopeMode: entry.targetScope === "unit"
        ? "unit"
        : ((entry.commonAreaName || "").toLowerCase() === "all units" ? "allBlock" : "block"),
      targetScope: entry.targetScope || (entry.unitId ? "unit" : "block"),
      blockId: entry.blockId || "",
      unitId: entry.unitId || "",
      commonAreaName: entry.commonAreaName || "",
      type: entry.type || "General",
      description: entry.description || "",
      scheduledDate: entry.scheduledDate || "",
      issueDate: entry.issueDate || entry.reportedDate || "",
      cost: entry.cost ?? "",
      contractor: entry.contractor || "",
      contractorContact: entry.contractorContact || "",
      location: entry.location || "",
      unitsCovered: entry.unitsCovered ?? "",
    });
    setShowEditMaint(true);
  }

  async function handleEditMaint() {
    setEditError("");
    const selectedBlockIds = Array.isArray(editMaint.blockIds) && editMaint.blockIds.length > 0
      ? editMaint.blockIds
      : (editMaint.blockId ? [editMaint.blockId] : []);
    const selectedBlocks = blocks.filter((b) => selectedBlockIds.includes(String(b.bid)));
    const block = selectedBlocks[0] || blocks.find((b) => String(b.bid) === String(editMaint.blockId));
    const unit = allUnits.find((u) => String(u.uid) === String(editMaint.unitId));
    if (selectedBlocks.length === 0 || !editMaint.description.trim()) {
      setEditError("Please select a block and enter a description.");
      return;
    }
    if (editMaint.scopeMode === "unit" && !unit) {
      setEditError("Please select a unit, or switch this request to block/common area.");
      return;
    }
    if (editMaint.scopeMode === "block" && !editMaint.commonAreaName.trim()) {
      setEditError("Please enter the common area name.");
      return;
    }
    const isAllUnits = editMaint.scopeMode === "allBlock";
    const commonAreaName = isAllUnits ? "All Units" : editMaint.commonAreaName.trim();

    const payload = {
      targetScope: editMaint.scopeMode === "unit" ? "unit" : "block",
      blockId: selectedBlocks[0]?.bid || block?.bid || "",
      blockIds: selectedBlockIds,
      unitId: editMaint.scopeMode === "unit" ? editMaint.unitId : "",
      commonAreaName,
      type: editMaint.type,
      description: editMaint.description,
      scheduledDate: editMaint.scheduledDate,
      issueDate: editMaint.issueDate,
      cost: Number(editMaint.cost) || 0,
      contractor: editMaint.contractor,
      contractorContact: editMaint.contractorContact,
      location: editMaint.location,
      unitsCovered: Number(editMaint.unitsCovered) || 0,
      label: editMaint.scopeMode === "unit"
        ? `${unit.blockName} / ${unit.name}`
        : `${selectedBlocks.map((b) => b.name).join(" + ")} / ${commonAreaName}`,
    };

    try {
      setIsEditing(true);
      await onEditMaint(editMaint.id, payload);
      clearEditDraft(editMaint.id);
      setShowEditMaint(false);
    } finally {
      setIsEditing(false);
    }
  }

  function isImageAttachment(attachment) {
    return typeof attachment?.mimeType === "string" && attachment.mimeType.startsWith("image/");
  }

  function openAttachmentViewer(entryId, attachment) {
    const fileUrl = maintenanceAttachmentUrl(entryId, attachment.aid);
    const isImg = isImageAttachment(attachment);
    setAttachmentViewer({
      name: attachment.name,
      isImg,
      url: fileUrl,
      downloadUrl: maintenanceAttachmentUrl(entryId, attachment.aid, true),
    });
  }

  function getMaintenanceBlockNames(entry) {
    const ids = Array.isArray(entry.blockIds) && entry.blockIds.length > 0
      ? entry.blockIds
      : (entry.blockId ? [entry.blockId] : []);
    return ids
      .map((bid) => blocks.find((b) => String(b.bid) === String(bid))?.name)
      .filter(Boolean);
  }

  const filteredUnits = newMaint.blockId
    ? (blocks.find((b) => String(b.bid) === String(newMaint.blockId))?.units || [])
    : allUnits;
  const filteredEditUnits = editMaint.blockId
    ? (blocks.find((b) => String(b.bid) === String(editMaint.blockId))?.units || [])
    : allUnits;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }} className="page-header">
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Maintenance Tracker</div>
        <Btn onClick={() => requireAuth(openAddMaint)}>+ Log Request</Btn>
      </div>

      {/* Status summary cards */}
      <div className="stat-grid" style={sGrid}>
        {[["Pending", C.amber, C.amberBg], ["In Progress", C.sky, C.skyBg], ["Completed", C.sage, C.sageBg], ["Cancelled", C.muted, "#f5f0eb"]].map(([s, accent, aBg]) => {
          const cnt  = maint.filter((m) => m.status === s).length;
          const cost = maint.filter((m) => m.status === s).reduce((a, m) => a + (m.cost || 0), 0);
          return (
            <div key={s} style={{ background: C.surface, border: `1px solid ${accent}55`, borderRadius: 12, padding: "17px 21px", position: "relative", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: accent }} />
              <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: aBg, opacity: 0.6 }} />
              <div style={{ fontSize: 25, fontWeight: 700, color: accent }}>{cnt}</div>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>{s}</div>
              <div style={{ fontSize: 12, color: C.faint, marginTop: 5 }}>{fmt(cost)}</div>
            </div>
          );
        })}
      </div>

      {/* Maintenance table */}
      <div className="app-card" style={card}>
        <div className="tbl-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Location", "Type", "Description", "Receipts", "Reported", "Scheduled", "Details", "Cost", "Status", "Update", "Edit", "Delete"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {maint.map((m) => {
              const sc = STATUS_COLORS[m.status];
              return (
                <tr key={m.id}>
                  <td style={td}>
                    <b>{m.label}</b>
                    {(() => {
                      const blockNames = getMaintenanceBlockNames(m);
                      if (blockNames.length === 0) return null;
                      return (
                        <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>Blocks</span>
                          {blockNames.map((name) => (
                            <span key={name} style={{ fontSize: 10, color: C.teal, background: C.tealBg, border: `1px solid ${C.teal}22`, borderRadius: 999, padding: "2px 8px", lineHeight: 1.2 }}>
                              {name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={td}>{m.type}</td>
                  <td style={{ ...td, maxWidth: 150 }}>{m.description}</td>
                  <td style={{ ...td, minWidth: 140 }}>
                    {Array.isArray(m.attachments) && m.attachments.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {m.attachments.map((a) => {
                          const key = `${m.id}:${a.aid}`;
                          const isDeleting = deletingAttachmentKey === key;
                          return (
                            <div key={a.aid} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <button
                                type="button"
                                onClick={() => openAttachmentViewer(m.id, a)}
                                style={{ background: "none", border: "none", padding: 0, margin: 0, color: C.teal, textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                              >
                                {isImageAttachment(a) ? (
                                  <img
                                    src={maintenanceAttachmentUrl(m.id, a.aid)}
                                    alt={a.name}
                                    style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", border: `1px solid ${C.border}` }}
                                  />
                                ) : (
                                  <span style={{ width: 34, height: 34, borderRadius: 6, border: `1px solid ${C.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.muted }}>DOC</span>
                                )}
                                <span style={{ maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(m.id, a.aid)}
                                disabled={isDeleting}
                                style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.rose, cursor: isDeleting ? "not-allowed" : "pointer", fontSize: 11, padding: "2px 6px" }}
                                title="Delete attachment"
                              >
                                {isDeleting ? "..." : "Delete"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : "-"}
                  </td>
                  <td style={td}>{fmtDate(m.reportedDate)}</td>
                  <td style={td}>{m.scheduledDate ? fmtDate(m.scheduledDate) : "—"}</td>
                  <td style={td}>
                    {m.contractor && <div>{m.contractor}</div>}
                    {m.contractorContact && <div style={{ fontSize: 11, color: C.muted }}>{m.contractorContact}</div>}
                    {m.location && <div style={{ fontSize: 11, color: C.muted }}>{m.location}</div>}
                  </td>
                  <td style={td}>{fmt(m.cost)}</td>
                  <td style={td}><Badge label={m.status} color={sc[0]} bg={sc[1]} /></td>
                  <td style={td}>
                    <select value={m.status} onChange={(e) => onUpdMaint(m.id, e.target.value)} style={{ ...iSt, width: "auto", padding: "5px 8px" }}>
                      {MAINT_STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <Btn variant="ghost" onClick={() => requireAuth(() => openEditModal(m))}>Edit</Btn>
                  </td>
                  <td style={td}>
                    <Btn variant="ghost" onClick={() => requireAuth(() => handleDeleteMaint(m.id))} disabled={deletingEntryId === m.id}>
                      {deletingEntryId === m.id ? "Deleting..." : "Delete"}
                    </Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {showAddMaint && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={(e) => e.target === e.currentTarget && setShowAddMaint(false)}
        >
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 30, width: "90%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: C.teal }}>Log Maintenance Request</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Drafts save automatically while this form is open and restore when you reopen it.</div>
            <div className="maint-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lSt}>Block</label>
                {newMaint.scopeMode === "unit" ? (
                  <select style={iSt} value={newMaint.blockId} onChange={(e) => setNewMaint((p) => ({ ...p, blockId: e.target.value, blockIds: [e.target.value], unitId: "" }))}>
                    <option value="">Select block...</option>
                    {blocks.map((b) => <option key={b.bid} value={b.bid}>{b.name}</option>)}
                  </select>
                ) : (
                  <select
                    style={{ ...iSt, minHeight: 92 }}
                    multiple
                    value={newMaint.blockIds || []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                      setNewMaint((p) => ({
                        ...p,
                        blockIds: selected,
                        blockId: selected[0] || "",
                        unitId: "",
                      }));
                    }}
                  >
                    {blocks.map((b) => <option key={b.bid} value={b.bid}>{b.name}</option>)}
                  </select>
                )}
                {newMaint.scopeMode !== "unit" && <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Hold Ctrl or Shift to select more than one block.</div>}
              </div>
              <div>
                <label style={lSt}>Request Scope</label>
                <select style={iSt} value={newMaint.scopeMode} onChange={(e) => setNewMaint((p) => ({ ...p, scopeMode: e.target.value, targetScope: e.target.value === "unit" ? "unit" : "block", unitId: "", commonAreaName: e.target.value === "allBlock" ? "All Units" : "" }))}>
                  <option value="unit">Specific Unit</option>
                  <option value="block">Block / Common Area</option>
                  <option value="allBlock">Entire Block / All Units</option>
                </select>
              </div>
              <div>
                <label style={lSt}>Unit</label>
                {newMaint.scopeMode === "unit" ? (
                  <select style={iSt} value={newMaint.unitId} onChange={(e) => setNewMaint((p) => ({ ...p, unitId: e.target.value }))}>
                    <option value="">Select unit...</option>
                    {filteredUnits.map((u) => <option key={u.uid} value={u.uid}>{newMaint.blockId ? u.name : `${u.blockName} / ${u.name}`}</option>)}
                  </select>
                ) : (
                  <input style={iSt} value={newMaint.scopeMode === "allBlock" ? "All units in this block" : "All units / common area"} disabled />
                )}
              </div>
              <div>
                <label style={lSt}>Common Area Name</label>
                <input
                  style={iSt}
                  type="text"
                  value={newMaint.commonAreaName}
                  placeholder={newMaint.scopeMode === "block" ? "Gate, Staircase, Water Tank..." : newMaint.scopeMode === "allBlock" ? "All Units" : "Only needed for block/common area"}
                  disabled={newMaint.scopeMode === "unit"}
                  onChange={(e) => setNewMaint((p) => ({ ...p, commonAreaName: e.target.value }))}
                />
              </div>
              <div>
                <label style={lSt}>Type</label>
                <select style={iSt} value={newMaint.type} onChange={(e) => setNewMaint((p) => ({ ...p, type: e.target.value }))}>
                  {MAINT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lSt}>Scheduled Date</label>
                <input style={iSt} type="date" value={newMaint.scheduledDate} onChange={(e) => setNewMaint((p) => ({ ...p, scheduledDate: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Issue Date</label>
                <input style={iSt} type="date" value={newMaint.issueDate} onChange={(e) => setNewMaint((p) => ({ ...p, issueDate: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lSt}>Description</label>
                <textarea style={{ ...iSt, resize: "vertical", minHeight: 75 }} value={newMaint.description} onChange={(e) => setNewMaint((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Estimated Cost (GHS)</label>
                <input style={iSt} type="number" value={newMaint.cost} onChange={(e) => setNewMaint((p) => ({ ...p, cost: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Contractor</label>
                <input style={iSt} type="text" value={newMaint.contractor} onChange={(e) => setNewMaint((p) => ({ ...p, contractor: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Contractor Contact</label>
                <input style={iSt} type="text" value={newMaint.contractorContact} onChange={(e) => setNewMaint((p) => ({ ...p, contractorContact: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lSt}>Location</label>
                <input style={iSt} type="text" value={newMaint.location} onChange={(e) => setNewMaint((p) => ({ ...p, location: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Units Covered</label>
                <input style={iSt} type="number" min="0" value={newMaint.unitsCovered} onChange={(e) => setNewMaint((p) => ({ ...p, unitsCovered: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lSt}>Receipt / Document (optional)</label>
                <input
                  style={iSt}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  multiple
                  onChange={(e) => setNewMaint((p) => ({ ...p, attachmentsFiles: Array.from(e.target.files || []) }))}
                />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                  {newMaint.attachmentsFiles.length > 0
                    ? `${newMaint.attachmentsFiles.length} file(s) selected`
                    : "Add receipt photos or maintenance documents."}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Btn variant="ghost" onClick={handleParseReceipt} disabled={isParsingReceipt || newMaint.attachmentsFiles.length === 0}>
                    {isParsingReceipt ? "Reading Receipt..." : "Auto-fill from Receipt"}
                  </Btn>
                </div>
                {newMaint.receiptBreakdown?.items?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>
                    Parsed {newMaint.receiptBreakdown.items.length} line item(s). Grand total: {fmt(newMaint.receiptBreakdown.grandTotal || 0)}
                  </div>
                )}
              </div>
            </div>
            {saveError && <div style={{ marginTop: 12, color: C.rose, fontSize: 12 }}>{saveError}</div>}
            <div style={{ display: "flex", gap: 9, marginTop: 18, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowAddMaint(false)}>Cancel</Btn>
              <Btn onClick={handleSaveMaint} disabled={isSaving}>{isSaving ? "Saving..." : "Save Request"}</Btn>
            </div>
          </div>
        </div>
      )}

      {showEditMaint && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120 }}
          onClick={(e) => e.target === e.currentTarget && setShowEditMaint(false)}
        >
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 30, width: "90%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: C.teal }}>Edit Maintenance Request</div>
            <div className="maint-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lSt}>Block</label>
                {editMaint.scopeMode === "unit" ? (
                  <select style={iSt} value={editMaint.blockId} onChange={(e) => setEditMaint((p) => ({ ...p, blockId: e.target.value, blockIds: [e.target.value], unitId: "" }))}>
                    <option value="">Select block...</option>
                    {blocks.map((b) => <option key={b.bid} value={b.bid}>{b.name}</option>)}
                  </select>
                ) : (
                  <select
                    style={{ ...iSt, minHeight: 92 }}
                    multiple
                    value={editMaint.blockIds || (editMaint.blockId ? [editMaint.blockId] : [])}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                      setEditMaint((p) => ({
                        ...p,
                        blockIds: selected,
                        blockId: selected[0] || "",
                        unitId: "",
                      }));
                    }}
                  >
                    {blocks.map((b) => <option key={b.bid} value={b.bid}>{b.name}</option>)}
                  </select>
                )}
                {editMaint.scopeMode !== "unit" && <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Hold Ctrl or Shift to select more than one block.</div>}
              </div>
              <div>
                <label style={lSt}>Request Scope</label>
                <select style={iSt} value={editMaint.scopeMode} onChange={(e) => setEditMaint((p) => ({ ...p, scopeMode: e.target.value, targetScope: e.target.value === "unit" ? "unit" : "block", unitId: "", commonAreaName: e.target.value === "allBlock" ? "All Units" : "" }))}>
                  <option value="unit">Specific Unit</option>
                  <option value="block">Block / Common Area</option>
                  <option value="allBlock">Entire Block / All Units</option>
                </select>
              </div>
              <div>
                <label style={lSt}>Unit</label>
                {editMaint.scopeMode === "unit" ? (
                  <select style={iSt} value={editMaint.unitId} onChange={(e) => setEditMaint((p) => ({ ...p, unitId: e.target.value }))}>
                    <option value="">Select unit...</option>
                    {filteredEditUnits.map((u) => <option key={u.uid} value={u.uid}>{editMaint.blockId ? u.name : `${u.blockName} / ${u.name}`}</option>)}
                  </select>
                ) : (
                  <input style={iSt} value={editMaint.scopeMode === "allBlock" ? "All units in this block" : "All units / common area"} disabled />
                )}
              </div>
              <div>
                <label style={lSt}>Common Area Name</label>
                <input
                  style={iSt}
                  type="text"
                  value={editMaint.commonAreaName}
                  placeholder={editMaint.scopeMode === "block" ? "Gate, Staircase, Water Tank..." : editMaint.scopeMode === "allBlock" ? "All Units" : "Only needed for block/common area"}
                  disabled={editMaint.scopeMode === "unit"}
                  onChange={(e) => setEditMaint((p) => ({ ...p, commonAreaName: e.target.value }))}
                />
              </div>
              <div>
                <label style={lSt}>Type</label>
                <select style={iSt} value={editMaint.type} onChange={(e) => setEditMaint((p) => ({ ...p, type: e.target.value }))}>
                  {MAINT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lSt}>Scheduled Date</label>
                <input style={iSt} type="date" value={editMaint.scheduledDate} onChange={(e) => setEditMaint((p) => ({ ...p, scheduledDate: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Issue Date</label>
                <input style={iSt} type="date" value={editMaint.issueDate} onChange={(e) => setEditMaint((p) => ({ ...p, issueDate: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lSt}>Description</label>
                <textarea style={{ ...iSt, resize: "vertical", minHeight: 75 }} value={editMaint.description} onChange={(e) => setEditMaint((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Estimated Cost (GHS)</label>
                <input style={iSt} type="number" value={editMaint.cost} onChange={(e) => setEditMaint((p) => ({ ...p, cost: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Contractor</label>
                <input style={iSt} type="text" value={editMaint.contractor} onChange={(e) => setEditMaint((p) => ({ ...p, contractor: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Contractor Contact</label>
                <input style={iSt} type="text" value={editMaint.contractorContact} onChange={(e) => setEditMaint((p) => ({ ...p, contractorContact: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lSt}>Location</label>
                <input style={iSt} type="text" value={editMaint.location} onChange={(e) => setEditMaint((p) => ({ ...p, location: e.target.value }))} />
              </div>
              <div>
                <label style={lSt}>Units Covered</label>
                <input style={iSt} type="number" min="0" value={editMaint.unitsCovered} onChange={(e) => setEditMaint((p) => ({ ...p, unitsCovered: e.target.value }))} />
              </div>
            </div>
            {editError && <div style={{ marginTop: 12, color: C.rose, fontSize: 12 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 9, marginTop: 18, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowEditMaint(false)}>Cancel</Btn>
              <Btn onClick={handleEditMaint} disabled={isEditing}>{isEditing ? "Saving..." : "Save Changes"}</Btn>
            </div>
          </div>
        </div>
      )}

      {attachmentViewer && (
        <div
          onClick={() => setAttachmentViewer(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(20,20,20,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 450 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#1a1a1a", borderRadius: 12, overflow: "hidden", width: "92vw", height: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 60px rgba(0,0,0,0.5)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#111", borderBottom: "1px solid #333", flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: "#ddd", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{attachmentViewer.name}</span>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <a
                  href={attachmentViewer.downloadUrl}
                  style={{ background: "#2a6", border: "none", color: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", textDecoration: "none" }}
                >
                  Download
                </a>
                <button onClick={() => setAttachmentViewer(null)} style={{ background: C.rose, border: "none", color: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700 }}>Close</button>
              </div>
            </div>
            {attachmentViewer.isImg ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 16, background: "#111" }}>
                <img src={attachmentViewer.url} alt={attachmentViewer.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6 }} />
              </div>
            ) : (
              <iframe
                key={attachmentViewer.url}
                src={attachmentViewer.url}
                title={attachmentViewer.name}
                style={{ flex: 1, border: "none", width: "100%", background: "#fff" }}
                allow="fullscreen"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

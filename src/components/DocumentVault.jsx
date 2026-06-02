import { useState, useRef } from "react";
import { C } from "../constants/colors";
import { DOC_CATS } from "../constants/options";
import { iSt, lSt } from "../styles/shared";
import { fmtSize } from "../utils/formatters";
import { fileIcon } from "../utils/helpers";

const API = import.meta.env.VITE_API_URL || "";

export default function DocumentVault({ docs = [], onAdd, onDelete, requireAuth }) {
  const ref = useRef();
  const [drag,        setDrag]        = useState(false);
  const [cat,         setCat]         = useState("Other");
  const [note,        setNote]        = useState("");
  const [docViewer,   setDocViewer]   = useState(null); // { url, name, isImg }
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState("");


  async function readFiles(files) {
    setUploading(true);
    setUploadError("");
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) { alert(`${file.name} exceeds 10 MB`); continue; }
        await onAdd(file, cat, note);
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || "Upload failed — please log in and try again.");
    } finally {
      setUploading(false);
      setNote("");
    }
  }

  function triggerFiles(files) {
    if (requireAuth) requireAuth(() => readFiles(files));
    else readFiles(files);
  }

  function triggerPicker() {
    if (uploading) return;
    if (requireAuth) requireAuth(() => ref.current.click());
    else ref.current.click();
  }

  // Group by leasePeriod (primary) then category (secondary). Newest period first.
  const periodMap = {};
  for (const doc of docs) {
    const period = doc.leasePeriod || "Earlier";
    if (!periodMap[period]) periodMap[period] = {};
    const cat = doc.category || "Other";
    if (!periodMap[period][cat]) periodMap[period][cat] = [];
    periodMap[period][cat].push(doc);
  }
  const sortedPeriods = Object.keys(periodMap).sort((a, b) => {
    if (a === "Earlier") return 1;
    if (b === "Earlier") return -1;
    return b.localeCompare(a); // newest period first
  });

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: C.teal, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
        📁 Documents <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>({docs.length} file{docs.length !== 1 ? "s" : ""})</span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); triggerFiles(e.dataTransfer.files); }}
        onClick={triggerPicker}
        style={{ border: `2px dashed ${drag ? C.teal : C.border}`, borderRadius: 10, padding: "16px 20px", textAlign: "center", cursor: uploading ? "default" : "pointer", background: drag ? C.tealBg : C.deep, transition: "all 0.2s", marginBottom: 12, opacity: uploading ? 0.7 : 1 }}
      >
        <div style={{ fontSize: 22, marginBottom: 4 }}>{uploading ? "⏳" : "⬆"}</div>
        <div style={{ fontSize: 13, color: drag ? C.teal : C.muted }}>{uploading ? "Uploading to cloud…" : drag ? "Drop files here" : "Click or drag & drop to upload"}</div>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>PDF · Word · Excel · Images · Max 10 MB</div>
        <input ref={ref} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp" style={{ display: "none" }} onChange={(e) => readFiles(e.target.files)} />
      </div>

      {/* Upload error */}
      {uploadError && (
        <div style={{ fontSize: 12, color: C.rose, background: C.roseBg, border: `1px solid ${C.rose}33`, borderRadius: 7, padding: "7px 12px", marginBottom: 10 }}>
          ⚠ {uploadError}
        </div>
      )}

      {/* Category & note */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lSt}>Category for next upload</label>
          <select style={iSt} value={cat} onChange={(e) => setCat(e.target.value)}>
            {DOC_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lSt}>Note (optional)</label>
          <input style={iSt} placeholder="e.g. Expires Dec 2026" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {/* File list — grouped by lease period, then category */}
      {docs.length === 0 ? (
        <div style={{ fontSize: 13, color: C.faint, padding: "8px 0" }}>No documents yet.</div>
      ) : (
        sortedPeriods.map((period) => (
          <div key={period} style={{ marginBottom: 16 }}>
            {/* Period header */}
            <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "5px 10px", background: C.tealBg, border: `1px solid ${C.teal}33`, borderRadius: 6, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              📅 {period === "Earlier" ? "Earlier (no period set)" : `Lease Period: ${period}`}
            </div>
            {Object.entries(periodMap[period]).map(([c, items]) => (
              <div key={c} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5, marginLeft: 2, paddingBottom: 3, borderBottom: `1px solid ${C.borderLight}` }}>{c}</div>
            {items.map((doc) => {
              const mimeType = doc.mimeType || doc.type || "";
              const fi = fileIcon(mimeType, doc.name);
              const isImg = mimeType.startsWith("image/");
              const isPdf = mimeType === "application/pdf";
              const isOffice = /word|excel|spreadsheet|officedocument/i.test(mimeType) ||
                               /\.(docx?|xlsx?|csv)$/i.test(doc.name || "");

              function viewDoc() {
                const run = () => {
                  if (!doc.did || !doc.url) return;
                  // doc.url is the public Cloudinary CDN URL — use it directly, no auth needed
                  if (isImg) {
                    setDocViewer({ did: doc.did, url: doc.url, name: doc.name, isImg: true });
                  } else if (isPdf) {
                    // Google PDF viewer renders Cloudinary-hosted PDFs reliably in an iframe
                    const gdocUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(doc.url)}&embedded=true`;
                    setDocViewer({ did: doc.did, url: doc.url, name: doc.name, isImg: false, iframeUrl: gdocUrl });
                  } else {
                    // Office docs: same Google Viewer approach
                    const gdocUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(doc.url)}&embedded=true`;
                    setDocViewer({ did: doc.did, url: doc.url, name: doc.name, isImg: false, iframeUrl: gdocUrl });
                  }
                };
                if (requireAuth) requireAuth(run); else run();
              }

              function downloadDoc() {
                const run = async () => {
                  try {
                    const token = localStorage.getItem("token");
                    const res = await fetch(`${API}/api/documents/${doc.did}/file?dl=1`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    if (!res.ok) throw new Error("Download failed");
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = doc.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                  } catch {
                    alert("Download failed. Please try again.");
                  }
                };
                if (requireAuth) requireAuth(run); else run();
              }

              return (
                <div key={doc.did} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${C.borderLight}`, borderRadius: 8, padding: "9px 12px", marginBottom: 5 }}>
                  {isImg ? (
                    <img src={doc.url} alt={doc.name} style={{ width: 34, height: 34, borderRadius: 5, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.border}`, cursor: "pointer" }} onClick={() => setPreview(doc)} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: 5, background: fi.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{fi.icon}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {fmtSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      {doc.note && <span style={{ color: C.faint }}> · {doc.note}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    {doc.did
                      ? <button onClick={viewDoc} style={{ background: C.skyBg, border: "none", color: C.sky, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>👁 View</button>
                      : <span style={{ fontSize: 11, color: C.rose, background: C.roseBg, border: `1px solid ${C.rose}44`, borderRadius: 6, padding: "4px 8px" }}>⚠ No file — delete & re-upload</span>
                    }
                    {doc.did && <button onClick={downloadDoc} style={{ background: C.sageBg, border: "none", color: C.sage, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>⬇</button>}
                    <button onClick={() => requireAuth ? requireAuth(() => onDelete(doc.did)) : onDelete(doc.did)} style={{ background: C.roseBg, border: "none", color: C.rose, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                </div>
              );
            })}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Document viewer modal */}
      {docViewer && (
        <div
          onClick={() => setDocViewer(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(20,20,20,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 400 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#1a1a1a", borderRadius: 12, overflow: "hidden", width: "92vw", height: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 60px rgba(0,0,0,0.5)" }}
          >
            {/* Modal toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#111", borderBottom: "1px solid #333", flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: "#ddd", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{docViewer.name}</span>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={async () => { const run = async () => { try { const token = localStorage.getItem("token"); const res = await fetch(`${API}/api/documents/${docViewer.did}/file?dl=1`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); if (!res.ok) throw new Error(); const blob = await res.blob(); const blobUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = blobUrl; a.download = docViewer.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(blobUrl); } catch { alert("Download failed."); } }; if (requireAuth) requireAuth(run); else run(); }} style={{ background: "#2a6", border: "none", color: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif" }}>⬇ Download</button>
                <button onClick={() => setDocViewer(null)} style={{ background: C.rose, border: "none", color: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 700 }}>✕ Close</button>
              </div>
            </div>
            {/* Content */}
            {docViewer.isImg ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 16 }}>
                <img src={docViewer.url} alt={docViewer.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6 }} />
              </div>
            ) : (
              <iframe
                src={docViewer.iframeUrl}
                title={docViewer.name}
                style={{ flex: 1, border: "none", width: "100%" }}
                allow="fullscreen"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
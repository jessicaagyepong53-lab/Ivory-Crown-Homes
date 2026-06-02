import { useState, useRef } from "react";
import { C } from "../constants/colors";
import { DOC_CATS } from "../constants/options";
import { iSt, lSt } from "../styles/shared";
import { fmtSize } from "../utils/formatters";
import { fileIcon } from "../utils/helpers";

export default function DocumentVault({ docs = [], onAdd, onDelete }) {
  const ref = useRef();
  const [drag,       setDrag]       = useState(false);
  const [cat,        setCat]        = useState("Other");
  const [note,       setNote]       = useState("");
  const [preview,    setPreview]    = useState(null);
  const [uploading,  setUploading]  = useState(false);

  async function readFiles(files) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) { alert(`${file.name} exceeds 10 MB`); continue; }
        await onAdd(file, cat, note);
      }
    } finally {
      setUploading(false);
      setNote("");
    }
  }

  const grouped = DOC_CATS.reduce((a, c) => {
    const items = docs.filter((d) => d.category === c);
    if (items.length) a[c] = items;
    return a;
  }, {});

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: C.teal, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
        📁 Documents <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>({docs.length} file{docs.length !== 1 ? "s" : ""})</span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); readFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && ref.current.click()}
        style={{ border: `2px dashed ${drag ? C.teal : C.border}`, borderRadius: 10, padding: "16px 20px", textAlign: "center", cursor: uploading ? "default" : "pointer", background: drag ? C.tealBg : C.deep, transition: "all 0.2s", marginBottom: 12, opacity: uploading ? 0.7 : 1 }}
      >
        <div style={{ fontSize: 22, marginBottom: 4 }}>{uploading ? "⏳" : "⬆"}</div>
        <div style={{ fontSize: 13, color: drag ? C.teal : C.muted }}>{uploading ? "Uploading to cloud…" : drag ? "Drop files here" : "Click or drag & drop to upload"}</div>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>PDF · Word · Excel · Images · Max 10 MB</div>
        <input ref={ref} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp" style={{ display: "none" }} onChange={(e) => readFiles(e.target.files)} />
      </div>

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

      {/* File list */}
      {docs.length === 0 ? (
        <div style={{ fontSize: 13, color: C.faint, padding: "8px 0" }}>No documents yet.</div>
      ) : (
        Object.entries(grouped).map(([c, items]) => (
          <div key={c} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${C.borderLight}` }}>{c}</div>
            {items.map((doc) => {
              const mimeType = doc.mimeType || doc.type || "";
              const fi = fileIcon(mimeType, doc.name);
              const isImg = mimeType.startsWith("image/");
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
                    {isImg && <button onClick={() => setPreview(doc)} style={{ background: C.skyBg, border: "none", color: C.sky, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>👁</button>}
                    <button onClick={() => window.open(doc.url, "_blank")} style={{ background: C.sageBg, border: "none", color: C.sage, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>⬇</button>
                    <button onClick={() => onDelete(doc.did)} style={{ background: C.roseBg, border: "none", color: C.rose, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Image preview overlay */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }}>
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={preview.name} style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 10, border: `1px solid ${C.border}`, objectFit: "contain" }} />
            <div style={{ position: "absolute", bottom: -30, left: 0, fontSize: 12, color: "#fff" }}>{preview.name}</div>
            <button onClick={() => setPreview(null)} style={{ position: "absolute", top: -12, right: -12, background: C.rose, border: "none", color: "#fff", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

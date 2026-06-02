import { useState } from "react";
import { C } from "../constants/colors";
import { iSt, lSt } from "../styles/shared";
import Btn from "../components/ui/Btn";
import BlockCard from "../components/BlockCard";

export default function Properties({ blocks, requireAuth, onEndLease, onSaveTenant, onAddTenant, onAddUnit, onDeleteUnit, onDeleteBlock, onAddBlock }) {
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlock, setNewBlock] = useState({ name: "", type: "block" });

  function handleAddBlock() {
    if (!newBlock.name) return;
    onAddBlock({ bid: Date.now(), name: newBlock.name, type: newBlock.type, units: [] });
    setNewBlock({ name: "", type: "block" });
    setShowAddBlock(false);
  }

  return (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Blocks & Properties</div>
        <Btn onClick={() => requireAuth(() => setShowAddBlock(true))}>+ Add Block / Property</Btn>
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
        Click a block to expand. Click a room to view tenants. The <b style={{ color: C.rose }}>✕ End Lease</b> button on each active tenant ends their lease and marks the unit vacant.
      </p>

      {blocks.map((b) => (
        <BlockCard
          key={b.bid}
          block={b}
          requireAuth={requireAuth}
          onEndLease={onEndLease}
          onSaveTenant={onSaveTenant}
          onAddTenant={onAddTenant}
          onAddUnit={onAddUnit}
          onDeleteUnit={onDeleteUnit}
          onDeleteBlock={onDeleteBlock}
        />
      ))}

      {/* Add Block Modal */}
      {showAddBlock && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(45,37,32,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={(e) => e.target === e.currentTarget && setShowAddBlock(false)}
        >
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 30, width: "90%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: C.teal }}>Add Block / Property</div>

            <div style={{ marginBottom: 13 }}>
              <label style={lSt}>Name *</label>
              <input style={iSt} placeholder="e.g. Block 4, Block 7, Shop B, Annex A..." value={newBlock.name} onChange={(e) => setNewBlock((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lSt}>Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["block", "Block (multiple rooms)"], ["standalone", "Standalone Unit"]].map(([v, l]) => (
                  <button key={v} onClick={() => setNewBlock((p) => ({ ...p, type: v }))} style={{ flex: 1, padding: "9px", border: `2px solid ${newBlock.type === v ? C.teal : C.border}`, borderRadius: 8, background: newBlock.type === v ? C.tealBg : C.deep, color: newBlock.type === v ? C.teal : C.muted, cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", fontWeight: 600 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
              {newBlock.type === "block" ? "You will add individual rooms inside after saving." : "A single unit — add a tenant directly inside."}
            </p>

            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowAddBlock(false)}>Cancel</Btn>
              <Btn onClick={handleAddBlock}>Save</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

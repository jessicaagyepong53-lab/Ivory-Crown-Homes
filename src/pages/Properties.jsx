import { useState } from "react";
import { C } from "../constants/colors";
import { iSt, lSt } from "../styles/shared";
import Btn from "../components/ui/Btn";
import BlockCard from "../components/BlockCard";
import { getLeaseStatus } from "../utils/helpers";

function PropertyGroup({ address, blocks, requireAuth, onEndLease, onSaveTenant, onAddTenant, onAddUnit, onDeleteUnit, onDeleteBlock, onRenew }) {
  const [open, setOpen] = useState(true);
  const totalUnits = blocks.reduce((s, b) => s + b.units.length, 0);
  const occUnits   = blocks.reduce((s, b) => s + b.units.filter(u => u.tenants.some(t => getLeaseStatus(t) === "active")).length, 0);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Address header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", background: C.surface, border: `2px solid ${C.teal}55`, borderRadius: open ? "12px 12px 0 0" : 12, cursor: "pointer", userSelect: "none", boxShadow: "0 2px 8px rgba(74,157,143,0.07)" }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, background: C.tealBg, border: `2px solid ${C.teal}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>🏠</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.teal }}>{address || "No Address"}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{blocks.length} block{blocks.length !== 1 ? "s" : ""} · {occUnits}/{totalUnits} rooms occupied</div>
        </div>
        <span style={{ color: C.teal, fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
      </div>

      {/* Blocks inside */}
      {open && (
        <div style={{ border: `2px solid ${C.teal}33`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "14px 16px", background: C.deep }}>
          {blocks.map(b => (
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
              onRenew={onRenew}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Properties({ blocks, requireAuth, onEndLease, onSaveTenant, onAddTenant, onAddUnit, onDeleteUnit, onDeleteBlock, onAddBlock, onRenew }) {
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlock, setNewBlock] = useState({ name: "", type: "block", address: "" });

  function handleAddBlock() {
    if (!newBlock.name) return;
    onAddBlock({ bid: Date.now(), name: newBlock.name, type: newBlock.type, address: newBlock.address, units: [] });
    setNewBlock({ name: "", type: "block", address: "" });
    setShowAddBlock(false);
  }

  // Group blocks by address
  const groups = [];
  blocks.forEach(b => {
    const key = b.address || "";
    const g = groups.find(g => g.address === key);
    if (g) g.blocks.push(b);
    else groups.push({ address: key, blocks: [b] });
  });

  return (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Properties</div>
        <Btn onClick={() => requireAuth(() => setShowAddBlock(true))}>+ Add Block / Property</Btn>
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
        Each address groups its blocks. Click an address to collapse/expand. Click a block → room → tenant to manage leases.
      </p>

      {groups.map(g => (
        <PropertyGroup
          key={g.address}
          address={g.address}
          blocks={g.blocks}
          requireAuth={requireAuth}
          onEndLease={onEndLease}
          onSaveTenant={onSaveTenant}
          onAddTenant={onAddTenant}
          onAddUnit={onAddUnit}
          onDeleteUnit={onDeleteUnit}
          onDeleteBlock={onDeleteBlock}
          onRenew={onRenew}
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
              <label style={lSt}>Property Address</label>
              <input style={iSt} placeholder="e.g. Flat 2, Buulaso, Community 25, Accra" value={newBlock.address} onChange={(e) => setNewBlock((p) => ({ ...p, address: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 13 }}>
              <label style={lSt}>Block Name *</label>
              <input style={iSt} placeholder="e.g. Block A, Block B, Annex..." value={newBlock.name} onChange={(e) => setNewBlock((p) => ({ ...p, name: e.target.value }))} />
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

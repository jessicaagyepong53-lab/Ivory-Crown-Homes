import { C } from "../constants/colors";

export const iSt = {
  width: "100%",
  background: C.deep,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  color: C.text,
  fontSize: 13,
  fontFamily: "Georgia,serif",
  boxSizing: "border-box",
};

export const lSt = {
  fontSize: 10,
  color: C.muted,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  display: "block",
  marginBottom: 5,
};

export const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 24,
  marginBottom: 20,
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

export const cTitle = {
  fontSize: 12,
  fontWeight: 700,
  color: C.teal,
  letterSpacing: 1.2,
  marginBottom: 16,
  textTransform: "uppercase",
};

export const th = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 10,
  color: C.muted,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  borderBottom: `1px solid ${C.border}`,
  background: C.panel,
};

export const td = {
  padding: "11px 14px",
  fontSize: 13,
  borderBottom: `1px solid ${C.borderLight}`,
  color: C.text,
  verticalAlign: "middle",
};

export const sGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 13,
  marginBottom: 22,
};

export const sGridClass = "stat-grid";
export const cardClass  = "app-card";
export const tblWrap    = { overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" };

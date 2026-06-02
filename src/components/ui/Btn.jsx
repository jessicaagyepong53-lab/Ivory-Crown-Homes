import { C } from "../../constants/colors";

export default function Btn({ children, onClick, variant = "primary", small, full, style = {} }) {
  const map = {
    primary:   { bg: C.teal,        col: "#fff",   bdr: "none" },
    danger:    { bg: C.rose,        col: "#fff",   bdr: "none" },
    end:       { bg: "#fff",        col: C.rose,   bdr: `2px solid ${C.rose}` },
    ghost:     { bg: "transparent", col: C.muted,  bdr: `1px solid ${C.border}` },
    secondary: { bg: C.panel,       col: C.text,   bdr: `1px solid ${C.border}` },
    amber:     { bg: C.amber,       col: "#fff",   bdr: "none" },
  };
  const v = map[variant] || map.primary;
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? "6px 14px" : "9px 20px",
        borderRadius: 8,
        border: v.bdr,
        cursor: "pointer",
        fontSize: small ? 11 : 13,
        fontFamily: "Georgia,serif",
        fontWeight: 600,
        letterSpacing: 0.4,
        background: v.bg,
        color: v.col,
        width: full ? "100%" : undefined,
        transition: "opacity 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

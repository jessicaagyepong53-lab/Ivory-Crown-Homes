import { C } from "../../constants/colors";

export default function Avatar({ name, size = 38 }) {
  const palette = [C.teal, C.sky, C.sage, C.lavender, C.amber, C.coral];
  const col = palette[name.charCodeAt(0) % palette.length];
  const ini = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${col}22`,
        border: `2px solid ${col}88`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.32,
        fontWeight: 700,
        color: col,
        flexShrink: 0,
      }}
    >
      {ini}
    </div>
  );
}

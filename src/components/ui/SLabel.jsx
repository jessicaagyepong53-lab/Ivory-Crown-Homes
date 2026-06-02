import { C } from "../../constants/colors";

export default function SLabel({ children, color }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: color || C.teal,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 10,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

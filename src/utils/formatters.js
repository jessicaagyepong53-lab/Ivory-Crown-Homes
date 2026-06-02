export const fmt     = (n) => `GHS ${Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtSize = (b) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

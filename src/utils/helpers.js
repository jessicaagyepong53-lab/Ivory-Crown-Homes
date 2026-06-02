import { C } from "../constants/colors";

export const today = new Date();

export const yr = (d) => (d ? new Date(d).getFullYear() : null);

export function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - today) / 86400000);
}

export function monthsAgo(d) {
  if (!d) return null;
  const m = Math.floor((today - new Date(d)) / (30.44 * 86400000));
  if (m < 1) return "less than a month ago";
  if (m === 1) return "1 month ago";
  if (m < 12) return `${m} months ago`;
  const y = Math.floor(m / 12), r = m % 12;
  return r ? `${y}yr ${r}mo ago` : `${y} year${y > 1 ? "s" : ""} ago`;
}

export function getReminderStatus(d) {
  const days = daysUntil(d);
  if (days === null) return null;
  if (days < 0)   return { label: "Overdue",        color: C.rose,  bg: "#fde8e8" };
  if (days <= 7)  return { label: `${days}d left`,  color: C.amber, bg: "#fff3e0" };
  if (days <= 30) return { label: `${days}d left`,  color: C.amber, bg: "#fff3e0" };
  if (days <= 90) return { label: `${days}d left`,  color: C.sky,   bg: "#e3f0fb" };
  return                 { label: `${days}d left`,  color: C.sage,  bg: "#e8f5ee" };
}

export function fileIcon(type, name) {
  const ext = name.split(".").pop().toLowerCase();
  if (type.startsWith("image/"))              return { icon: "🖼", bg: "#e3f0fb" };
  if (type === "application/pdf" || ext === "pdf") return { icon: "📄", bg: "#fde8e8" };
  if (["doc", "docx"].includes(ext))          return { icon: "📝", bg: "#ede8fb" };
  if (["xls", "xlsx"].includes(ext))          return { icon: "📊", bg: "#e8f5ee" };
  return { icon: "📎", bg: "#fff3e0" };
}

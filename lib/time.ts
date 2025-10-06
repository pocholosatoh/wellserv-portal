// lib/time.ts
export function fmtManila(ts: string | Date | null | undefined) {
  if (!ts) return "-";
  const d = typeof ts === "string" ? new Date(ts) : ts;
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(ts);
  }
}

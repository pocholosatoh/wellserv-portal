// lib/time.ts

/** Pretty date-time in Asia/Manila (kept from your version) */
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

/** Date-only (e.g., for showing due dates cleanly) */
export function fmtManilaDate(ts: string | Date | null | undefined) {
  if (!ts) return "-";
  const d = typeof ts === "string" ? new Date(ts) : ts;
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(d);
  } catch {
    return String(ts);
  }
}

/** Internal: get components of "now" in Manila */
function _phParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  // "YYYY-MM-DD, HH:MM:SS" in Asia/Manila
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return parts as {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
  };
}

/** YYYY-MM-DD string for "today" in Asia/Manila */
export function phTodayYMD(d = new Date()): string {
  const p = _phParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Convert a Date/ISO to YYYY-MM-DD using Asia/Manila day */
export function toYMDManila(ts: string | Date): string {
  const p = _phParts(typeof ts === "string" ? new Date(ts) : ts);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Simple YMD helpers for client-side classification */
export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYMDManila(dt);
}

export function compareYMD(a: string, b: string): number {
  // returns -1 if a<b, 0 if ==, 1 if a>b
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isDueTodayYMD(dueYMD: string, todayYMD = phTodayYMD()): boolean {
  return compareYMD(dueYMD, todayYMD) === 0;
}

export function isOverdueYMD(dueYMD: string, todayYMD = phTodayYMD()): boolean {
  return compareYMD(dueYMD, todayYMD) < 0;
}

export function isPastGraceYMD(validUntilYMD: string, todayYMD = phTodayYMD()): boolean {
  return compareYMD(validUntilYMD, todayYMD) < 0;
}

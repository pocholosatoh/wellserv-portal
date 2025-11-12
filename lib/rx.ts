// lib/rx.ts
export const FREQ_DICT: Record<string, string> = {
  OD: "once daily",
  QD: "once daily",
  QAM: "every morning",
  QPM: "every evening",
  BID: "twice daily",
  TID: "three times daily",
  QID: "four times daily",
  HS: "at bedtime",
  PRN: "as needed",
};

export function describeFrequency(code?: string) {
  if (!code) return "";
  const k = String(code).toUpperCase().trim();
  return FREQ_DICT[k] ? `${FREQ_DICT[k]} (${k})` : k;
}

export const DEFAULT_RX_VALID_DAYS = 30;
const MAX_RX_VALID_DAYS = 365;

export function parseValidDays(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  const clamped = Math.min(num, MAX_RX_VALID_DAYS);
  return Math.round(clamped);
}

export function normalizeValidDays(value: unknown, fallback = DEFAULT_RX_VALID_DAYS) {
  const parsed = parseValidDays(value);
  return parsed ?? fallback;
}

export function computeValidUntil(days: number, base = new Date()) {
  const dt = new Date(base);
  if (!Number.isFinite(days)) return dt;
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + Math.round(days));
  return dt;
}

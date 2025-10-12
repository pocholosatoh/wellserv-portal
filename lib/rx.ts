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

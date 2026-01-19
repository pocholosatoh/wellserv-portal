export function formatPrcNo(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/^prc\s*-?\s*/i, "").trim();
  return cleaned || null;
}

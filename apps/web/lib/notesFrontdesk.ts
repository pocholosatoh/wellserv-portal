export function normalizeManualNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const collapse = (input: string) => input.replace(/\s+/g, " ").trim();
  const collapsed = collapse(trimmed);
  if (!collapsed) return null;

  if (collapsed.includes(",")) {
    const tokens = collapsed
      .split(",")
      .map((token) => collapse(token))
      .filter(Boolean);
    return tokens.length ? tokens.join(", ") : null;
  }

  return collapsed;
}

export function mergeFrontdeskNotes(
  canonical: string | null | undefined,
  manual: string | null | undefined,
): string | null {
  const canonicalValue = (canonical || "").trim();
  const manualValue = (manual || "").trim();

  if (canonicalValue && manualValue) {
    return `${canonicalValue} | MANUAL: ${manualValue}`;
  }
  if (manualValue) return `MANUAL: ${manualValue}`;
  return canonicalValue || null;
}

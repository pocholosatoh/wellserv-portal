// lib/hema.ts

/** -----------------------------
 * Types
 * ------------------------------*/
export type HemaRowInternal = {
  patient_id: string;
  WBC?: number | "";
  Lympho?: number | "";   // fraction 0.xx
  MID?: number | "";      // fraction 0.xx
  Gran?: number | "";     // fraction 0.xx
  RBC?: number | "";
  Hemoglobin?: number | "";
  Hematocrit?: number | "";
  MCV?: number | "";
  MCH?: number | "";
  MCHC?: number | "";
  Platelet?: number | "";
};

export type HemaRowSheet = {
  patient_id: string;
  hema_wbc?: number | "";
  hema_lymph?: number | "";
  hema_mid?: number | "";
  hema_gran?: number | "";
  hema_rbc?: number | "";
  hema_hgb?: number | "";
  hema_hct?: number | "";
  hema_mcv?: number | "";
  hema_mch?: number | "";
  hema_mchc?: number | "";
  hema_plt?: number | "";
};

/** -----------------------------
 * Destination headers in Google Sheet
 * ------------------------------*/
export const HEMA_DEST_HEADERS: ReadonlyArray<keyof HemaRowSheet | "patient_id"> = [
  "patient_id",
  "hema_wbc",
  "hema_lymph",
  "hema_mid",
  "hema_gran",
  "hema_rbc",
  "hema_hgb",
  "hema_hct",
  "hema_mcv",
  "hema_mch",
  "hema_mchc",
  "hema_plt",
];

export const OUTPUT_ORDER = [...HEMA_DEST_HEADERS] as string[];

/** -----------------------------
 * CSV Header Aliases (input side)
 * ------------------------------*/
const CSV_ALIASES = {
  patient_id: ["patient_id", "PatientID", "Patient ID", "ID"] as const,
  WBC: ["WBC", "WBC (10^9/L)"] as const,
  Lympho: ["Lympho", "Lymph", "Lymph% ( )", "Lymph%", "Lymph %"] as const,
  MID: ["MID", "Mid% ( )", "Mid%", "Mid %", "Mid"] as const,
  Gran: ["Gran", "Gran% ( )", "Gran%", "Gran %", "Granulocyte"] as const,
  RBC: ["RBC", "RBC (10^12/L)"] as const,
  Hemoglobin: ["Hemoglobin", "HGB (g/L)", "HGB"] as const,
  Hematocrit: ["Hematocrit", "HCT ( )", "HCT"] as const,
  MCV: ["MCV", "MCV (fL)"] as const,
  MCH: ["MCH", "MCH (pg)"] as const,
  MCHC: ["MCHC", "MCHC (g/L)"] as const,
  Platelet: ["Platelet", "PLT (10^9/L)", "PLT"] as const,
};

/** -----------------------------
 * Internal key -> Sheet column map (output side)
 * ------------------------------*/
const COLUMN_MAP: Record<
  Exclude<keyof HemaRowInternal, "patient_id">,
  keyof HemaRowSheet
> = {
  WBC: "hema_wbc",
  Lympho: "hema_lymph",
  MID: "hema_mid",
  Gran: "hema_gran",
  RBC: "hema_rbc",
  Hemoglobin: "hema_hgb",
  Hematocrit: "hema_hct",
  MCV: "hema_mcv",
  MCH: "hema_mch",
  MCHC: "hema_mchc",
  Platelet: "hema_plt",
};

/** -----------------------------
 * Small utilities
 * ------------------------------*/
function pick(r: Record<string, any>, names: readonly string[]) { // <— accepts readonly array
  for (const n of names) {
    if (n in r && r[n] != null && String(r[n]).trim() !== "") return r[n];
  }
  return null;
}

function toNum(v: any): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[, ]+/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number | null | undefined): number | "" {
  if (n == null || !Number.isFinite(n)) return "";
  return Math.round(n * 100) / 100;
}

function percentishToFraction(n: number | null): number | null {
  if (n == null) return null;
  if (n > 1.0 + 1e-9) return n / 100; // 28 -> 0.28
  return n;
}

/** Normalize Lympho/MID/Gran trio to fractions 0.xx that sum to exactly 1.00.
 *  Rules:
 *  - Inputs may be percents (e.g., 28) or fractions (0.28).
 *  - If all three provided, we round L & M, then set G := 1 - (L + M).
 *  - If exactly one is missing, we compute the missing one as 1 - sum(others).
 *  - If two are missing, we keep the provided one and split the remainder as 0 for one and the rest for the last,
 *    but in practice your CSV provides at least two, so this is a rare edge.
 */
export function normalizeTrioToFrac(
  lymphIn: any,
  midIn: any,
  granIn: any
): { Lympho: number | ""; MID: number | ""; Gran: number | "" } {
  const toFrac = (v: any): number | null => {
    const n = toNum(v);
    if (n == null) return null;
    return n > 1.0 + 1e-9 ? n / 100 : n; // treat >1 as percent -> fraction
  };

  let L = toFrac(lymphIn);
  let M = toFrac(midIn);
  let G = toFrac(granIn);

  // If all empty
  if (L == null && M == null && G == null) return { Lympho: "", MID: "", Gran: "" };

  // Count provided
  const haveL = L != null;
  const haveM = M != null;
  const haveG = G != null;
  const count = (haveL ? 1 : 0) + (haveM ? 1 : 0) + (haveG ? 1 : 0);

  // Helper to clamp+round
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const r2 = (x: number) => Math.round(x * 100) / 100;

  if (count >= 2) {
    // Prefer to preserve L and M, then solve for G
    const Lr = r2((L ?? 0));
    const Mr = r2((M ?? 0));

    // If G is the missing one OR even if present, we recompute G to force exact sum=1
    let Gr = r2(1 - (Lr + Mr));

    // Clamp
    const Lrc = clamp01(Lr);
    const Mrc = clamp01(Mr);
    const Grc = clamp01(Gr);

    return { Lympho: Lrc, MID: Mrc, Gran: Grc };
  }

  // If exactly one provided, set that and infer the rest as 0 and 1 - provided.
  if (count === 1) {
    if (haveL) {
      const Lr = clamp01(r2(L!));
      const rest = clamp01(r2(1 - Lr));
      // Put rest into Gran by default, MID = 0
      return { Lympho: Lr, MID: 0, Gran: rest };
    }
    if (haveM) {
      const Mr = clamp01(r2(M!));
      const rest = clamp01(r2(1 - Mr));
      // Put rest into Gran by default, Lympho = 0
      return { Lympho: 0, MID: Mr, Gran: rest };
    }
    if (haveG) {
      const Gr = clamp01(r2(G!));
      const rest = clamp01(r2(1 - Gr));
      // Put rest into Lympho by default, MID = 0
      return { Lympho: rest, MID: 0, Gran: Gr };
    }
  }

  // Fallback: if we somehow get here, return zeros that sum to 1
  return { Lympho: 0, MID: 0, Gran: 1 };
}

/** -----------------------------
 * CSV → Internal normalization
 * ------------------------------*/
export function sanitizeHemaRows(rows: any[]): HemaRowInternal[] {
  return rows
    .map((r: Record<string, any>) => {
      const pid = String(pick(r, CSV_ALIASES.patient_id) ?? "").trim();
      if (!pid) return null;

      const trio = normalizeTrioToFrac(
        pick(r, CSV_ALIASES.Lympho),
        pick(r, CSV_ALIASES.MID),
        pick(r, CSV_ALIASES.Gran)
      );

      const obj: HemaRowInternal = {
        patient_id: pid,
        WBC: round2(toNum(pick(r, CSV_ALIASES.WBC))),
        Lympho: trio.Lympho,
        MID: trio.MID,
        Gran: trio.Gran,
        RBC: round2(toNum(pick(r, CSV_ALIASES.RBC))),
        Hemoglobin: round2(toNum(pick(r, CSV_ALIASES.Hemoglobin))),
        Hematocrit: round2(toNum(pick(r, CSV_ALIASES.Hematocrit))),
        MCV: round2(toNum(pick(r, CSV_ALIASES.MCV))),
        MCH: round2(toNum(pick(r, CSV_ALIASES.MCH))),
        MCHC: round2(toNum(pick(r, CSV_ALIASES.MCHC))),
        Platelet: round2(toNum(pick(r, CSV_ALIASES.Platelet))),
      };

      return obj;
    })
    .filter(Boolean) as HemaRowInternal[];
}

/** -----------------------------
 * Internal → Sheet row mapping
 * ------------------------------*/
export function toSheetRow(internal: HemaRowInternal): HemaRowSheet {
  const out: HemaRowSheet = { patient_id: internal.patient_id };
  (Object.keys(COLUMN_MAP) as Array<keyof typeof COLUMN_MAP>).forEach((k) => {
    const dest = COLUMN_MAP[k];
    (out as any)[dest] = (internal as any)[k] ?? "";
  });
  return out;
}

export function toValuesArray(sheetRow: HemaRowSheet): any[] {
  return OUTPUT_ORDER.map((h) => (sheetRow as any)[h] ?? "");
}

/** -----------------------------
 * Sheet header helpers
 * ------------------------------*/
export function assertHemaHeaders(headersRow0: string[]) {
  const missing = HEMA_DEST_HEADERS.filter((h) => !headersRow0.includes(h));
  if (missing.length) {
    throw new Error(`Missing headers in sheet: ${missing.join(", ")}`);
  }
}

export function makeIndexMap(headersRow0: string[]) {
  const map: Record<string, number> = {};
  for (const h of headersRow0) map[h] = headersRow0.indexOf(h);
  return map;
}

/** Convenience: bulk transform to values[][] */
export function buildValuesForSheet(internals: HemaRowInternal[]): any[][] {
  return internals.map((row) => toValuesArray(toSheetRow(row)));
}

// lib/hema.ts
import { google } from "googleapis";

export type HemaRow = {
  patient_id: string;
  WBC?: number | null;
  Lympho?: number | null;
  MID?: number | null;
  Gran?: number | null;
  RBC?: number | null;
  Hemoglobin?: number | null;
  Hematocrit?: number | null;
  MCV?: number | null;
  MCH?: number | null;
  MCHC?: number | null;
  Platelet?: number | null;
};

const TAB = (process.env.HEMA_TAB || "Database").trim();
const MAX_COLUMN_INDEX = 24; // Column X
const MAX_COLUMN_A1 = colToA1(MAX_COLUMN_INDEX);

// exact column headers we expect in the sheet (and CSV)
export const HEMA_HEADERS = [
  "WBC","Lympho","MID","Gran","RBC","Hemoglobin","Hematocrit","MCV","MCH","MCHC","Platelet",
];

// ---- Google Sheets client (RW) ----
let _client: ReturnType<typeof google.sheets> | null = null;
async function getSheetsRW() {
  if (_client) return _client;
  const email = must(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const pk = must(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key: pk,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _client = google.sheets({ version: "v4", auth });
  return _client;
}
function must(v: string | undefined, name: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// ---- helpers used in hema parsing ----
function toNum(s: any): number | null {
  const t = String(s ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// round to 2 decimals; keep nulls as null
const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

// normalize Lympho/MID/Gran to FRACTIONS (0..1) that sum to exactly 1.00
export function normalizeTrioToFrac(a: any, b: any, c: any) {
  const r2 = (x: number) => Math.round(x * 100) / 100; // local helper for non-nullable numbers

  const A = toNum(a), B = toNum(b), C = toNum(c);
  if (A == null && B == null && C == null) return { Lympho: null, MID: null, Gran: null };

  // accept either percents (28) or fractions (0.28)
  const asFrac = (v: number | null) => v == null ? 0 : (v > 1.0001 ? v / 100 : v);

  let fA = asFrac(A), fB = asFrac(B), fC = asFrac(C);
  const sum = fA + fB + fC;
  if (sum <= 0) return { Lympho: null, MID: null, Gran: null };

  // normalize, then round and force exact sum = 1.00
  fA /= sum; fB /= sum; fC /= sum;
  let L = r2(fA), M = r2(fB), G = r2(1 - L - M);
  if (G < 0) { G = 0; L = r2(1 - M); }
  const diff = r2(1 - (L + M + G));
  if (diff !== 0) G = r2(G + diff);

  // clamp
  L = Math.min(1, Math.max(0, L));
  M = Math.min(1, Math.max(0, M));
  G = Math.min(1, Math.max(0, G));

  return { Lympho: L, MID: M, Gran: G };
}

// Helper: get first non-empty value among a list of header aliases
function pick(r: Record<string, any>, names: string[]) {
  for (const n of names) {
    // match both exact and trimmed keys
    if (n in r && r[n] != null && String(r[n]).trim() !== "") return r[n];
  }
  return null;
}

// Aliases for NEW CSV headers -> internal keys we write to the sheet
const CSV_ALIASES = {
  patient_id: ["patient_id", "PatientID", "Patient ID"],

  WBC:        ["WBC", "WBC (10^9/L)"],
  Lympho:     ["Lympho", "Lymph% ( )", "Lymph%", "Lymph %"],
  MID:        ["MID", "Mid% ( )", "Mid%", "Mid %"],
  Gran:       ["Gran", "Gran% ( )", "Gran%", "Gran %"],
  RBC:        ["RBC", "RBC (10^12/L)"],
  Hemoglobin: ["Hemoglobin", "HGB (g/L)", "HGB"],
  Hematocrit: ["Hematocrit", "HCT ( )", "HCT"],
  MCV:        ["MCV", "MCV (fL)"],
  MCH:        ["MCH", "MCH (pg)"],
  MCHC:       ["MCHC", "MCHC (g/L)"],
  Platelet:   ["Platelet", "PLT (10^9/L)", "PLT"],
};

export function sanitizeHemaRows(rows: any[]): HemaRow[] {
  return rows
    .map((r: Record<string, any>) => {
      const pid = String(pick(r, CSV_ALIASES.patient_id) ?? "").trim();
      if (!pid) return null;

      // Trio normalization: accepts % (e.g., 28) or fraction (0.28); returns 0.xx and sums to 1.00
      const trio = normalizeTrioToFrac(
        pick(r, CSV_ALIASES.Lympho),
        pick(r, CSV_ALIASES.MID),
        pick(r, CSV_ALIASES.Gran)
      );

      const obj: HemaRow = {
        patient_id: pid,
        WBC:        round2(toNum(pick(r, CSV_ALIASES.WBC))),
        Lympho:     trio.Lympho,  // 0.xx
        MID:        trio.MID,     // 0.xx
        Gran:       trio.Gran,    // 0.xx
        RBC:        round2(toNum(pick(r, CSV_ALIASES.RBC))),
        Hemoglobin: round2(toNum(pick(r, CSV_ALIASES.Hemoglobin))),
        Hematocrit: round2(toNum(pick(r, CSV_ALIASES.Hematocrit))),
        MCV:        round2(toNum(pick(r, CSV_ALIASES.MCV))),
        MCH:        round2(toNum(pick(r, CSV_ALIASES.MCH))),
        MCHC:       round2(toNum(pick(r, CSV_ALIASES.MCHC))),
        Platelet:   round2(toNum(pick(r, CSV_ALIASES.Platelet))),
      };
      return obj;
    })
    .filter(Boolean) as HemaRow[];
}

/**
 * Update the Database tab of the given sheet by matching patient_id and writing hema columns.
 * - Does not append new rows.
 * - Does not create new columns: returns missingHeaders if any are not found.
 */
export async function updateHemaToDatabase(sheetId: string, rows: HemaRow[]) {
  if (!rows.length) return { updatedRows: 0, notFound: [] as string[], missingHeaders: [] as string[] };

  const api = await getSheetsRW();

  // read entire tab
  const { data } = await api.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${TAB}!A:${MAX_COLUMN_A1}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
    majorDimension: "ROWS",
  });

  const matrixRaw: any[][] = (data.values as any[][]) || [];
  const matrix = matrixRaw.map(row => row.slice(0, MAX_COLUMN_INDEX));
  const headers: string[] = (matrix[0] || []).map(h => String(h).trim());
  if (!headers.length) throw new Error(`Sheet ${sheetId} "${TAB}" has no header row`);

  // indexes
  const colIndex = new Map<string, number>();
  headers.forEach((h, i) => colIndex.set(h, i));
  const pidCol = colIndex.get("patient_id");
  if (pidCol == null) throw new Error(`"${TAB}" tab must have a "patient_id" header`);

  // ensure hema headers exist
  const missingHeaders = HEMA_HEADERS.filter(h => !colIndex.has(h));
  if (missingHeaders.length) {
    return { updatedRows: 0, notFound: [], missingHeaders };
  }

  // build patient_id -> row number (1-based)
  const rowIndexByPid = new Map<string, number>();
  for (let r = 1; r < matrix.length; r++) {
    const pid = String(matrix[r]?.[pidCol] ?? "").trim().toLowerCase();
    if (pid) rowIndexByPid.set(pid, r + 1); // include header offset
  }

  // prepare updates per row (write a full row back to avoid per-cell spam)
  const updates: Array<{ range: string; values: any[][] }> = [];
  const notFound: string[] = [];
  for (const hema of rows) {
    const key = hema.patient_id.trim().toLowerCase();
    const r1 = rowIndexByPid.get(key);
    if (!r1) { notFound.push(hema.patient_id); continue; }

    // existing row values
    const row0 = (matrix[r1 - 1] || []).slice();
    while (row0.length < MAX_COLUMN_INDEX) row0.push("");
    row0.splice(MAX_COLUMN_INDEX);

    // set only our hema headers
    for (const h of HEMA_HEADERS) {
      const i = colIndex.get(h)!;
      (row0 as any[])[i] = (hema as any)[h] ?? ""; // write number or empty
    }

    updates.push({
      range: `${TAB}!A${r1}:${MAX_COLUMN_A1}${r1}`,
      values: [row0],
    });
  }

  if (updates.length) {
    await api.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });
  }

  return { updatedRows: updates.length, notFound, missingHeaders };
}

function colToA1(n: number) {
  // 1 -> A, 2 -> B ... 27 -> AA
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

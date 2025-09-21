// lib/sheets.ts
import { google } from "googleapis";

type RawRow = any[];
export type Row = Record<string, string>;
export type ConfigMap = Record<string, string>;

const DEMO_KEYS = new Set([
  "barcode", "patient_id", "full_name", "age", "sex", "birthday", "contact",
  "address", "date_of_test", "notes"
]);

const HIDDEN_KEYS = new Set(["hema_100"]);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isEmptyLike(x: any) {
  const s = String(x ?? "").trim().toUpperCase();
  return s === "" || s === "-" || s.startsWith("#") || s.includes("VALUE!");
}

// ---- Google Sheets client (singleton for dev hot-reload) ----
let _client: ReturnType<typeof google.sheets> | null = null;

async function getSheetsClient() {
  if (_client) return _client;
  const email = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawKey = requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  const key = rawKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  _client = google.sheets({ version: "v4", auth });
  return _client;
}

async function fetchRange(rangeA1: string): Promise<RawRow[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = requireEnv("SHEET_ID");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
    majorDimension: "ROWS",
  });
  return (res.data.values as RawRow[]) || [];
}

// ---- Helpers: rows <-> objects ----
export async function readHeaderRow(rangeA1: string): Promise<string[]> {
  const values = await fetchRange(rangeA1);
  return (values?.[0] ?? []).map((h: any) => String(h).trim());
}
function rowsToObjects(values: RawRow[]): Row[] {
  if (!values.length) return [];
  const headers = (values[0] as string[]).map(h => String(h).trim());
  return values.slice(1).map(r => {
    const obj: Row = {};
    headers.forEach((h, i) => (obj[h] = r[i] != null ? String(r[i]) : ""));
    return obj;
  });
}

// Normalize object keys to snake_case (for tolerant column headers)
function normalizeKeys<T extends Row>(row: T): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = String(k)
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "_")   // spaces, slashes, punctuation -> _
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    out[nk] = typeof v === "string" ? v.trim() : (v as any);
  }
  return out as T;
}

// ---- Public readers ----
export async function readResults(): Promise<Row[]> {
  const range = requireEnv("SHEET_RANGE");     // e.g., "Results!A:ZZ"
  const values = await fetchRange(range);
  return rowsToObjects(values);
}
export async function readRanges(): Promise<Row[]> {
  const range = requireEnv("SHEET_RANGES");    // e.g., "Ranges!A:K"
  const values = await fetchRange(range);
  return rowsToObjects(values);
}

export async function readConfig(): Promise<Record<string,string>> {
  const range = requireEnv("SHEET_CONFIG");    // e.g., "Config!A:B"
  const values = await fetchRange(range);
  const out: Record<string,string> = {};
  for (const row of values) {
    const [k, v] = row;
    if (k != null) out[String(k).trim()] = v != null ? String(v).trim() : "";
  }
  return out;
}

/**
 * Read the Patients tab.
 * Uses env SHEET_PATIENTS if provided, otherwise defaults to "Patients!A:ZZ".
 * Keys are normalized to snake_case for resilience (e.g., "Past Surgical Hi" -> "past_surgical_hi").
 */
export async function readPatients(): Promise<Row[]> {
  const range = process.env.SHEET_PATIENTS || "Patients!A:ZZ";
  try {
    const values = await fetchRange(range);
    const rows = rowsToObjects(values);
    return rows.map(normalizeKeys);
  } catch (e) {
    // If the sheet/tab doesn't exist yet, return empty to keep API resilient
    return [];
  }
}

// ---- Domain helpers (mapping/flags/sections) ----
export type RangeMeta = {
  analyte_key: string;
  label?: string;
  section?: string;
  unit?: string;
  type?: "numeric" | "text" | "categorical" | "scale" | "";
  decimals?: number;
  sex?: "M" | "F" | "";
  low?: number | "";
  high?: number | "";
  normal_values?: string;   // e.g., “Negative”
  scaling_order?: string;   // e.g., “Negative<Trace<1+<2+...”
  age_min?: number | "";
  age_max?: number | "";
};

export function buildRangeMap(rows: Row[]): Record<string, RangeMeta[]> {
  // allow multiple rows per analyte (e.g., sex-specific)
  const map: Record<string, RangeMeta[]> = {};
  for (const r of rows) {
    const key = (r["analyte_key"] || "").trim();
    if (!key) continue;
    const meta: RangeMeta = {
      analyte_key: key,
      label: r["label"]?.trim(),
      section: r["section"]?.trim(),
      unit: r["unit"]?.trim(),
      type: (r["type"]?.trim()?.toLowerCase() as any) || "",
      decimals: r["decimals"] ? Number(r["decimals"]) : undefined,
      sex: (r["sex"]?.trim()?.toUpperCase() as any) || "",
      low: r["low"] !== "" && r["low"] != null ? Number(r["low"]) : "",
      high: r["high"] !== "" && r["high"] != null ? Number(r["high"]) : "",
      normal_values: r["normal_values"]?.trim(),
      scaling_order: r["scaling_order"]?.trim(),
      age_min: r["age_min"] !== "" && r["age_min"] != null ? Number(r["age_min"]) : "",
      age_max: r["age_max"] !== "" && r["age_max"] != null ? Number(r["age_max"]) : "",
    };
    (map[key] ||= []).push(meta);
  }
  return map;
}

function titleize(s: string) {
  // fallback: snake_case -> Title Case, preserving common abbreviations
  const abbr = new Set(["WBC","RBC","HGB","HCT","MCV","MCH","MCHC","PLT","ALT","AST","TSH","FT3","FT4","T3","T4","HIV","HCV","NS1","FOBT","RPV"]);
  return s.split("_").map(w => {
    const u = w.toUpperCase();
    if (abbr.has(u)) return u;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

function normalizeSex(s?: string) {
  const v = (s || "").trim().toUpperCase();
  if (v.startsWith("M")) return "M";
  if (v.startsWith("F")) return "F";
  return "";
}

function chooseMeta(
  metas: RangeMeta[] | undefined,
  patientSex: string,
  ageYears?: number
): RangeMeta | undefined {
  if (!metas || !metas.length) return undefined;

  const sx = normalizeSex(patientSex);
  const inBand = (m: RangeMeta) => {
    const minOk = typeof m.age_min !== "number" || (ageYears != null && ageYears >= m.age_min);
    const maxOk = typeof m.age_max !== "number" || (ageYears != null && ageYears <  m.age_max);
    return minOk && maxOk;
  };

  // Prefer sex + age match
  const sexAge = metas.find(m => (m.sex || "") === sx && sx !== "" && inBand(m));
  if (sexAge) return sexAge;

  // Then sex-only
  const sexOnly = metas.find(m => (m.sex || "") === sx && sx !== "");
  if (sexOnly) return sexOnly;

  // Then age-only
  const ageOnly = metas.find(inBand);
  return ageOnly || metas[0];
}

function computeFlag(valRaw: string, meta?: RangeMeta): "" | "L" | "H" | "A" {
  if (!meta || isEmptyLike(valRaw)) return "";
  const v = Number(valRaw);

  // Numeric (or looks numeric)
  if (meta.type === "numeric" || (!meta.type && !Number.isNaN(v))) {
    if (!Number.isNaN(v)) {
      if (typeof meta.low === "number" && v < meta.low) return "L";
      if (typeof meta.high === "number" && v > meta.high) return "H";
    }
    return "";
  }

  // Text/categorical: mark "A" if not in normal_values (when provided)
  if (meta.normal_values) {
    const normal = meta.normal_values.split(",").map(x => x.trim().toLowerCase());
    if (!normal.includes(String(valRaw).toLowerCase())) return "A";
  }

  return "";
}

function formatValue(valRaw: string, meta?: RangeMeta): string {
  if (isEmptyLike(valRaw)) return "";
  if (meta?.decimals != null && meta.decimals >= 0) {
    const n = Number(valRaw);
    if (!Number.isNaN(n)) return n.toFixed(meta.decimals);
  }
  return valRaw ?? "";
}

function deriveSectionFromKey(key: string): string {
  if (key.startsWith("hema_")) return "Hematology";
  if (key.startsWith("chem_")) return "Chemistry";
  if (key.startsWith("ua_"))   return "Urinalysis";
  if (key.startsWith("fa_"))   return "Fecalysis";
  if (key.startsWith("sero_")) return "Serology";
  return "Others";
}

export type ReportItem = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  flag?: "" | "L" | "H" | "A";
  ref?: { low?: number; high?: number; normal_values?: string };
};
export type ReportSection = { name: string; items: ReportItem[] };
export type PatientBlock = {
  patient_id: string; full_name: string; age: string; sex: string;
  birthday: string; contact: string; address: string;
};
export type VisitBlock = { date_of_test: string; barcode: string; notes: string };

export function buildReportForRow(row: Row, rangeMap: Record<string, RangeMeta[]>): {
  patient: PatientBlock; visit: VisitBlock; sections: ReportSection[];
} {
  const patient: PatientBlock = {
    patient_id: row["patient_id"] || "",
    full_name:  row["full_name"]  || "",
    age:        row["age"]        || "",
    sex:        row["sex"]        || "",
    birthday:   row["birthday"]   || "",
    contact:    row["contact"]    || "",
    address:    row["address"]    || "",
  };
  const visit: VisitBlock = {
    date_of_test: row["date_of_test"] || "",
    barcode:      row["barcode"]      || "",
    notes:        row["notes"]        || "",
  }; 

  const ageYears: number | undefined = (() => {
    const a = Number(row["age"]);
    if (!Number.isNaN(a) && a >= 0) return a;

    const bdRaw = row["birthday"];
    const dtRaw = row["date_of_test"];
    const bd = bdRaw ? new Date(bdRaw) : undefined;
    const dt = dtRaw ? new Date(dtRaw) : new Date();
    if (bd && !Number.isNaN(bd.getTime())) {
      const diffMs = dt.getTime() - bd.getTime();
      if (diffMs >= 0) return diffMs / (365.2425 * 24 * 60 * 60 * 1000); // ~years
    }
    return undefined;
  })();

  const bySection: Record<string, ReportItem[]> = {};
  for (const [key, raw] of Object.entries(row)) {
    if (DEMO_KEYS.has(key)) continue;
    if (HIDDEN_KEYS.has(key)) continue;
    // Skip blanks, '-' and spreadsheet error strings (e.g., #VALUE!)
    if (isEmptyLike(raw)) continue;

    const meta = chooseMeta(rangeMap[key], patient.sex, ageYears);
    const label = meta?.label || titleize(key);
    const value = formatValue(String(raw), meta);
    const flag  = computeFlag(String(raw), meta);
    const unit  = meta?.unit || "";

    const sectionName = meta?.section || deriveSectionFromKey(key);
    (bySection[sectionName] ||= []).push({
      key, label, value, unit,
      flag,
      ref: {
        low: typeof meta?.low === "number" ? meta?.low : undefined,
        high: typeof meta?.high === "number" ? meta?.high : undefined,
        normal_values: meta?.normal_values,
      }
    });
  }

  const sections: ReportSection[] = Object.entries(bySection)
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { patient, visit, sections };
}

// Convenience filters
export function filterByPatientId(rows: Row[], id: string) {
  const tgt = id.trim().toLowerCase();
  return rows.filter(r => (r["patient_id"] || "").trim().toLowerCase() === tgt);
}
export function filterByDate(rows: Row[], yyyyMmDd?: string) {
  if (!yyyyMmDd) return rows;
  return rows.filter(r => (r["date_of_test"] || "").startsWith(yyyyMmDd));
}
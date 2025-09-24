// lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

export type Row = Record<string, any>;

export function getSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------- helpers ----------
function snake<T extends Row>(row: T): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = String(k)
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    out[nk] = v;
  }
  return out as T;
}

// Escape % and _ so they DON'T act as wildcards in ILIKE
function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

// ---------- readers ----------
/** Config as a simple key→value map */
export async function sbReadConfig(): Promise<Record<string, string>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("config").select("key,value");
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const r of data || []) {
    const k = String(r.key ?? "").trim();
    if (k) out[k] = String(r.value ?? "");
  }
  return out;
}

/** Ranges shaped like the old sheet */
export async function sbReadRanges(): Promise<Row[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("ranges").select("*");
  if (error) throw error;
  return (data || []).map(snake);
}

/** Prefer results_wide (1 row per visit) */
async function sbReadResultsWideByPatient(patientId: string): Promise<Row[]> {
  const supabase = getSupabase();
  const pid = escapeLikeExact(String(patientId || "").trim());
  const { data, error } = await supabase
    .from("results_wide")
    .select("*")
    .ilike("patient_id", pid) // exact case-insensitive match (no wildcards)
    .order("date_of_test", { ascending: true });
  if (error) throw error;
  return (data || []).map(snake);
}

/** Fallback: read results_flat and pivot flat→wide per visit */
async function sbReadResultsFlatByPatient(patientId: string): Promise<Row[]> {
  const supabase = getSupabase();
  const pid = escapeLikeExact(String(patientId || "").trim());
  const { data, error } = await supabase
    .from("results_flat")
    .select("*")
    .ilike("patient_id", pid)
    .order("date_of_test", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  const flat = (data || []).map(snake);
  if (!flat.length) return [];

  // discover likely key/value columns
  const keyField =
    ["analyte_key", "key", "parameter_key", "param_key", "analyte", "parameter"].find(
      (k) => k in flat[0]
    ) || "analyte_key";
  const valField =
    ["value", "result", "val", "res"].find((k) => k in flat[0]) || "value";

  const groups = new Map<string, Row>();
  for (const r of flat) {
    const gk = [r.patient_id ?? "", r.date_of_test ?? "", r.barcode ?? "", r.notes ?? ""].join("|");
    let obj = groups.get(gk);
    if (!obj) {
      obj = {
        patient_id: r.patient_id ?? "",
        date_of_test: r.date_of_test ?? "",
        barcode: r.barcode ?? "",
        notes: r.notes ?? "",
      };
      groups.set(gk, obj);
    }
    const key = String(r[keyField] ?? "").trim();
    if (key) (obj as any)[key] = r[valField] ?? "";
  }
  return Array.from(groups.values()).map(snake);
}

/** Public: read results as "wide" rows, using wide first then flat→wide */
export async function sbReadResultsByPatient(patientId: string): Promise<Row[]> {
  const wide = await sbReadResultsWideByPatient(patientId);
  if (wide.length) return wide;
  return await sbReadResultsFlatByPatient(patientId);
}

/** Patient summary (Patients table) */
export async function sbReadPatientById(patientId: string): Promise<Row | null> {
  const supabase = getSupabase();
  const pid = escapeLikeExact(String(patientId || "").trim());
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .ilike("patient_id", pid)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? snake(data as Row) : null;
}

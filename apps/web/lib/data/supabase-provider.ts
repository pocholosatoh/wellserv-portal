// lib/data/supabase-provider.ts
import type {
  DataProvider,
  Patient,
  Visit,
  Report,
  ReportSection,
  ReportItem,
  VitalsSnapshot,
} from "./data-provider";
import { getSupabase } from "@/lib/supabase";

/* ----------------- helpers ----------------- */
function isPlaceholder(x: any): boolean {
  if (x === null || x === undefined) return true;
  const s = String(x).trim();
  return s === "" || s === "-" || s === "—" || s.toLowerCase() === "n/a";
}

// Parse common date formats → timestamp (ms). Handles ISO and M/D/YYYY (and D/M/YYYY when obvious).
function ts(d: string | null | undefined): number {
  if (!d) return 0;
  const s = String(d).trim();
  // Try native parser first (works for ISO like 2025-09-25)
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return t;

  // Try M/D/YYYY or D/M/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    // If first number >12, it's D/M/Y; otherwise assume M/D/Y
    const isDMY = a > 12;
    const month = isDMY ? b - 1 : a - 1;
    const day   = isDMY ? a     : b;
    return new Date(y, month, day).getTime();
  }

  return 0; // fall back
}

function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const s = String(x).replace(/,/g, "").trim();
  if (isPlaceholder(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function pick<T>(...vals: T[]): T | null {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && isPlaceholder(v)) continue;
    return v;
  }
  return null;
}
// exact, case-insensitive match for ILIKE (escape % and _)
function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}
function prefixToSection(key: string): string {
  const k = (key || "").toLowerCase();
  if (k.startsWith("hema_")) return "Hematology";
  if (k.startsWith("chem_")) return "Blood Chemistry";
  if (k.startsWith("fa_"))   return "Fecalysis";
  if (k.startsWith("ua_"))   return "Urinalysis";
  if (k.startsWith("sero_")) return "Serology";
  return "Others";
}

/* ---------- default per-section order (fallback when no ranges.order) ---------- */
const DEFAULT_ORDER: Record<string, string[]> = {
  Hematology: [
    "hema_wbc", "hema_lymph", "hema_mid", "hema_gran",
    "hema_rbc", "hema_hgb", "hema_hct", "hema_mcv", "hema_mch", "hema_mchc",
    "hema_plt", "hema_bt", "hema_remarks",
  ],
  "Blood Chemistry": [
    "chem_ogbase", "chem_og1st", "chem_og2nd", "chem_fbs", "chem_rbs", "chem_hba1c",
    "chem_chole", "chem_trigly", "chem_hdl", "chem_ldl", "chem_vldl",
    "chem_bun", "chem_crea", "chem_bua",
    "chem_ast", "chem_alt",
    "chem_tsh", "chem_ft3", "chem_ft4", "chem_t3", "chem_t4",
    "chem_psa", "chem_remarks",
  ],
  Urinalysis: [
    "ua_color", "ua_trans", "ua_glu", "ua_pro", "ua_ph", "ua_sg", "blood",
    "ua_bilirubin", "ua_urobili", "ua_ketones", "ua_nitrites", "ua_le",
    "ua_cast", "ua_casttype", "ua_crystals", "ua_crystalstype",
    "ua_epi", "ua_muc", "ua_ura", "ua_pho",
    "ua_bac", "ua_pus", "ua_rbc", "ua_remarks",
  ],
  Fecalysis: [
    "fa_color",	"fa_cons", "fa_pus", "fa_rbc",
    "fa_bac", "fa_yeast", "fa_fat", "fa_para", "fa_paratype",
    "fa_fobt", "fa_remarks",
],
  Serology: [
    "sero_dengns1", "sero_dengm", "sero_dengg",
    "sero_hepab", "sero_rpv", "sero_hiv", "sero_hcv", "sero_pt",
    "sero_remarks"
],
  Others: [],
};
function buildOrderIndex(rangesRows: Record<string, any>[]) {
  const byKeyOrder = new Map<string, number>();
  // ranges may have order-like columns; use first that exists
  for (const r of rangesRows) {
    const key = String(
      r.analyte_key ?? r.key ?? r.parameter_key ?? r.param_key ?? ""
    ).trim();
    if (!key) continue;
    const orderRaw = (r.order ?? r.sort_order ?? r.rank ?? r.prio ?? null);
    const orderNum = toNum(orderRaw);
    if (orderNum !== null) byKeyOrder.set(key, orderNum);
  }
  return byKeyOrder;
}
function sortItemsInSections(
  sections: ReportSection[],
  rangesRows: Record<string, any>[]
): ReportSection[] {
  const orderIndex = buildOrderIndex(rangesRows);
  return sections.map((sec) => {
    const defaults = DEFAULT_ORDER[sec.name] ?? [];
    const defaultIndex = new Map<string, number>();
    defaults.forEach((k, i) => defaultIndex.set(k, i));

    const items = [...sec.items].sort((a, b) => {
      const ao = orderIndex.get(a.key);
      const bo = orderIndex.get(b.key);
      if (ao !== undefined || bo !== undefined) {
        if (ao === undefined) return 1;
        if (bo === undefined) return -1;
        return ao - bo;
      }
      const ad = defaultIndex.get(a.key);
      const bd = defaultIndex.get(b.key);
      if (ad !== undefined || bd !== undefined) {
        if (ad === undefined) return 1;
        if (bd === undefined) return -1;
        return ad - bd;
      }
      // final fallback: alphabetical by label then key
      const al = (a.label || "").toLowerCase();
      const bl = (b.label || "").toLowerCase();
      if (al !== bl) return al < bl ? -1 : 1;
      return (a.key || "").localeCompare(b.key || "");
    });

    return { ...sec, items };
  });
}

/* ----------------- provider ----------------- */
type RangeMeta = {
  section?: string | null;
  label?: string | null;
  unit?: string | null;
  low?: number | string | null;
  high?: number | string | null;
};

export function createSupabaseProvider(): DataProvider {
  const TABLE_PATIENTS = "patients";
  const TABLE_RESULTS  = "results_flat";
  const TABLE_RANGES   = "ranges";
  const TABLE_VITALS   = "vitals_snapshots";
  const TABLE_RESULTS_WIDE = "results_wide";

  const db = getSupabase();

  // cache ranges + raw rows (for ordering)
  let rangesCache: Map<string, RangeMeta> | null = null;
  let rangesRowsCache: Record<string, any>[] | null = null;

  async function getRangesMap(): Promise<{ map: Map<string, RangeMeta>; rows: Record<string, any>[] }> {
    if (rangesCache && rangesRowsCache) return { map: rangesCache, rows: rangesRowsCache };
    const { data, error } = await db.from(TABLE_RANGES).select("*");
    if (error) throw error;

    const rows = (data || []) as Record<string, any>[];
    const map = new Map<string, RangeMeta>();
    for (const r of rows) {
      const key = String(
        r.analyte_key ?? r.key ?? r.parameter_key ?? r.param_key ?? ""
      ).trim();
      if (!key) continue;

      const section =
        (r.section ?? r.group ?? r.category ?? null) || prefixToSection(key);
      const label =
        (r.item_label ?? r.display_name ?? r.label ?? r.name ?? null) || null;
      const unit = r.unit ?? r.units ?? r.uom ?? null;
      // Your ranges use "low"/"high" (may be text); keep raw for display, numeric for flag logic
      const low  = r.low  ?? null;
      const high = r.high ?? null;

      map.set(key, { section, label, unit, low, high });
    }
    rangesCache = map;
    rangesRowsCache = rows;
    return { map, rows };
  }

  type VitalsBundle = { latest: VitalsSnapshot | null; history: VitalsSnapshot[] };

  async function fetchVitalsSnapshots(
    patient_id: string,
    opts?: { limit?: number; consultation_id?: string | null; encounter_id?: string | null; }
  ): Promise<VitalsBundle> {
    const pid = escapeLikeExact(String(patient_id || "").trim());
    let query = db
      .from(TABLE_VITALS)
      .select("*")
      .ilike("patient_id", pid)
      .order("measured_at", { ascending: false });

    if (opts?.consultation_id) query = query.eq("consultation_id", opts.consultation_id);
    if (opts?.encounter_id) query = query.eq("encounter_id", opts.encounter_id);
    query = query.limit(opts?.limit ?? 8);

    const { data, error } = await query;
    if (error) throw error;

    const rows: VitalsSnapshot[] = (data || []).map((r) => ({
      id: String(r.id),
      patient_id: String(r.patient_id),
      consultation_id: String(r.consultation_id),
      encounter_id: String(r.encounter_id),
      measured_at: (r.measured_at ?? r.created_at ?? new Date().toISOString()) as string,
      systolic_bp: toNum(r.systolic_bp),
      diastolic_bp: toNum(r.diastolic_bp),
      hr: toNum(r.hr),
      rr: toNum(r.rr),
      temp_c: r.temp_c == null ? null : Number(r.temp_c),
      height_cm: r.height_cm == null ? null : Number(r.height_cm),
      weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
      bmi: r.bmi == null ? null : Number(r.bmi),
      o2sat: toNum(r.o2sat),
      notes: r.notes ?? null,
      source: r.source ?? null,
      created_at: r.created_at ?? null,
      created_by_initials: r.created_by_initials ?? null,
    }));

    return {
      latest: rows[0] ?? null,
      history: rows,
    };
  }

  async function fallbackPatientFromResults(patient_id: string): Promise<Patient | null> {
    const pid = escapeLikeExact(String(patient_id || "").trim());
    const { data, error } = await db
      .from(TABLE_RESULTS_WIDE)
      .select("*")
      .ilike("patient_id", pid)
      .order("date_of_test", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const vitals = await fetchVitalsSnapshots(patient_id).catch(
      (): VitalsBundle => ({ latest: null, history: [] })
    );

    return {
      patient_id: data.patient_id ?? patient_id,
      full_name:  data.full_name ?? "",
      sex:        data.sex ?? "",
      age:        data.age ?? "",
      birthday:   data.birthday ?? "",
      contact:    data.contact ?? "",
      address:    data.address ?? "",
      email:      data.email ?? "",
      systolic_bp: "",
      diastolic_bp: "",
      height_ft: "",
      height_inch: "",
      weight_kg: "",
      medications_current: "",
      medications: "",
      family_history: "",
      smoking_hx: "",
      alcohol_hx: "",
      vitals,
      last_updated: data.last_updated ?? "",
    };
  }

  async function listVisitRows(patient_id: string): Promise<Visit[]> {
    const pid = escapeLikeExact(String(patient_id || "").trim());

    const { data, error } = await db
      .from(TABLE_RESULTS)
      .select("date_of_test, barcode, branch, notes")
      .ilike("patient_id", pid);

    if (error) throw error;
    if (data && data.length > 0) {
      return (data as Record<string, any>[]).map((r) => ({
        date_of_test: String(r.date_of_test ?? "").trim(),
        barcode: r.barcode ?? "",
        branch: r.branch ?? "",
        notes: r.notes ?? "",
      }));
    }

    // Fallback to wide table for legacy rows
    const { data: wide, error: wideError } = await db
      .from(TABLE_RESULTS_WIDE)
      .select("date_of_test, barcode, branch, notes")
      .ilike("patient_id", pid);

    if (wideError) throw wideError;

    return (wide || []).map((r: any) => ({
      date_of_test: String(r?.date_of_test ?? "").trim(),
      barcode: r?.barcode ?? "",
      branch: r?.branch ?? "",
      notes: r?.notes ?? "",
    }));
  }

  async function fetchResultRows(patient_id: string, visitDate?: string): Promise<Record<string, any>[]> {
    const pid = escapeLikeExact(String(patient_id || "").trim());
    let query = db
      .from(TABLE_RESULTS)
      .select("*")
      .ilike("patient_id", pid);

    if (visitDate) query = query.eq("date_of_test", visitDate);

    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) return data as Record<string, any>[];

    // Fallback to the wide table: explode wide columns into flat rows
    let wideQuery = db
      .from(TABLE_RESULTS_WIDE)
      .select("*")
      .ilike("patient_id", pid);

    if (visitDate) wideQuery = wideQuery.eq("date_of_test", visitDate);

    const { data: wide, error: wideError } = await wideQuery;
    if (wideError) throw wideError;
    if (!wide || wide.length === 0) return [];

    const skipKeys = new Set([
      "patient_id",
      "date_of_test",
      "barcode",
      "notes",
      "branch",
      "id",
      "created_at",
      "updated_at",
      "created_by",
      "updated_by",
      "created_by_initials",
    ]);

    const flat: Record<string, any>[] = [];
    for (const row of wide as Record<string, any>[]) {
      const base = {
        patient_id: row.patient_id ?? patient_id,
        date_of_test: row.date_of_test ?? visitDate ?? "",
        barcode: row.barcode ?? "",
        notes: row.notes ?? "",
        branch: row.branch ?? "",
      };
      for (const [key, val] of Object.entries(row)) {
        if (skipKeys.has(key)) continue;
        if (val === null || val === undefined || isPlaceholder(val)) continue;
        flat.push({
          ...base,
          analyte_key: key,
          item_key: key,
          value: val,
        });
      }
    }

    return flat;
  }

  return {
    async getPatient(patient_id: string): Promise<Patient | null> {
      const pid = escapeLikeExact(String(patient_id || "").trim());
      const { data, error } = await db
        .from(TABLE_PATIENTS)
        .select("*")
        .ilike("patient_id", pid)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // Legacy rows might exist only in results_wide
        const fallback = await fallbackPatientFromResults(patient_id);
        if (!fallback) return null;
        return fallback;
      }

      const medsCurrent = data.medications_current ?? "";

      const vitals = await fetchVitalsSnapshots(patient_id).catch(
        (): VitalsBundle => ({ latest: null, history: [] })
      );

      const p: Patient = {
        patient_id: data.patient_id,
        full_name:  data.full_name ?? "",
        sex:        data.sex ?? "",
        age:        data.age ?? "",
        birthday:   data.birthday ?? "",
        contact:    data.contact ?? "",
        address:    data.address ?? "",
        email:      data.email ?? "",
        height_ft:  data.height_ft ?? "",
        height_inch:data.height_inch ?? "",
        weight_kg:  data.weight_kg ?? "",
        systolic_bp:data.systolic_bp ?? "",
        diastolic_bp:data.diastolic_bp ?? "",
        last_updated: data.last_updated ?? "",
        present_illness_history: data.present_illness_history ?? "",
        past_medical_history:    data.past_medical_history ?? "",
        past_surgical_history:   data.past_surgical_history ?? "",
        chief_complaint:         data.chief_complaint ?? "",
        allergies_text:          data.allergies_text ?? "",
        medications_current:     medsCurrent,
        medications:             medsCurrent,           // mirror for UI compatibility
        family_history:          data.family_hx ?? "",  // source is family_hx
        smoking_hx:              data.smoking_hx ?? "",
        alcohol_hx:              data.alcohol_hx ?? "",
        vitals,
      };
      return p;
    },

    async getVisits(patient_id: string): Promise<Visit[]> {
      const visitRows = await listVisitRows(patient_id);

      const seen = new Map<string, Visit>();
      for (const r of visitRows) {
        const rawDate = (r as any).date_of_test ?? (r as any).date ?? (r as any).test_date ?? "";
        const date = String(rawDate).trim();
        if (!date || isPlaceholder(date)) continue;
        if (!seen.has(date)) {
          seen.set(date, {
            date_of_test: date,
            barcode: r.barcode ?? "",
            branch:  r.branch ?? "",
            notes:   r.notes ?? "",
          });
        }
      }
      return Array.from(seen.values()).sort((a, b) => ts(b.date_of_test) - ts(a.date_of_test));
    },

    async getReport({ patient_id, visitDate }: { patient_id: string; visitDate?: string; }): Promise<Report | null> {
      const patient =
        (await this.getPatient(patient_id)) ||
        ({
          patient_id,
          full_name: "",
          vitals: { latest: null, history: [] },
        } as Patient);

      let date = visitDate;
      if (!date) {
        const visits = await this.getVisits(patient_id);
        date = visits[0]?.date_of_test;
        if (!date) return null;
      }

      const rows = await fetchResultRows(patient_id, date);
      if (rows.length === 0) return null;

      const { map: rangesMap, rows: rangesRows } = await getRangesMap();
      const bySection = new Map<string, ReportItem[]>();

      for (const r of rows) {
        const key = String(
          r.item_key ??
          r.analyte_key ??
          r.parameter_key ??
          r.param_key ??
          r.key ??
          ""
        ).trim();
        const meta = key ? rangesMap.get(key) : undefined;

        const label = String(
          pick(
            r.item_label,
            r.display_name,
            r.parameter_label,
            r.label,
            meta?.label,
            key || null
          ) ?? ""
        ).trim();

        // unit: never allow "null" string
        const unitRaw = pick(r.unit, r.units, r.uom, meta?.unit);
        const unit = unitRaw == null ? "" : String(unitRaw);

        // section from ranges or prefix
        const section = String(
          pick(r.section, r.item_section, r.dept, r.category, meta?.section, prefixToSection(key || label), "Others")
        );

        // value: treat "-" etc as null; keep numeric if possible for flags
        const rawVal = pick(r.value, r.result, r.val);
        const valueNum = toNum(rawVal);
        const value: number | string | null =
          valueNum !== null ? valueNum : (isPlaceholder(rawVal) ? null : (rawVal as any));

        // references (display raw, compute flags via numeric)
        const rawLow  = pick(r.ref_low,  r.low,  meta?.low);
        const rawHigh = pick(r.ref_high, r.high, meta?.high);
        const ref_low_display  = isPlaceholder(rawLow)  ? null : (rawLow  as any);
        const ref_high_display = isPlaceholder(rawHigh) ? null : (rawHigh as any);
        const refLowNum  = toNum(rawLow);
        const refHighNum = toNum(rawHigh);

        // flag: prefer DB; else compute L/H only (do NOT show "N")
        let flag: "L" | "H" | "A" | null = null;
        const rawFlag = (pick(r.flag) as any) ?? null;
        if (rawFlag) {
          const f = String(rawFlag).toUpperCase();
          if (f === "L" || f === "H" || f === "A") flag = f as any;
        } else if (valueNum !== null) {
          if (refLowNum !== null && valueNum < refLowNum) flag = "L";
          else if (refHighNum !== null && valueNum > refHighNum) flag = "H";
          // else normal → leave null (you don't want "N")
        }

        const item: ReportItem = {
          key,
          label,
          unit,
          value,
          ref_low:  ref_low_display,
          ref_high: ref_high_display,
          flag,
          method:  r.method ?? null,
          remarks: r.remarks ?? null,
        };

        // skip placeholders/blank values entirely (don't render)
        if (item.value === null || (typeof item.value === "string" && isPlaceholder(item.value))) {
          continue;
        }

        const arr = bySection.get(section) ?? [];
        arr.push(item);
        bySection.set(section, arr);
      }

      // sort items in each section
      let sections: ReportSection[] =
        Array.from(bySection.entries())
          .map(([name, items]) => ({ name, items }))
          .filter(sec => sec.items.some(i => i.value !== null && String(i.value).trim() !== ""));
      sections = sortItemsInSections(sections, rangesRows);

      const first = rows[0] || {};
      const visit: Visit = {
        date_of_test: date,
        barcode: first.barcode ?? "",
        branch:  first.branch ?? "",
        notes:   first.notes ?? "",
      };

      return { patient, visit, sections };
    },

    async searchPatients({ query, limit = 20, offset = 0 }) {
      const q = (query || "").trim();
      if (!q) return { results: [], total: 0 };

      const pat = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      const { data, error, count } = await db
        .from(TABLE_PATIENTS)
        .select("patient_id, full_name, sex, age, birthday, contact, address, email", { count: "exact" })
        .or(`patient_id.ilike.${pat},full_name.ilike.${pat}`)
        .order("full_name", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { results: (data || []) as Patient[], total: count ?? undefined };
    },

    async getConfig() {
      return { footer_lines: [], signatories: [] };
    },
  };
}

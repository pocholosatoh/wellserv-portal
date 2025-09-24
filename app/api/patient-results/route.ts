// app/api/patient-results/route.ts
import { NextResponse } from "next/server";
import {
  sbReadConfig,
  sbReadRanges,
  sbReadResultsByPatient,
  sbReadPatientById,
  Row,
} from "@/lib/supabase";
import { buildRangeMap, buildReportForRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/**
 * Utility: normalize and compare strings safely
 */
function lc(s: any) {
  return String(s ?? "").trim().toLowerCase();
}
function normLabel(s: any) {
  return lc(s).replace(/[_\-:.]+/g, " ").replace(/\s+/g, " ");
}

/**
 * Any keys/labels we NEVER want to render as “Parameters”
 */
const EXCLUDE_KEYS = new Set([
  "branch",
  "created_at",
  "updated_at",
  "inserted_at",
  "modified_at",
  "created_at_utc",
  "updated_at_utc",
]);

const EXCLUDE_LABELS = new Set([
  "branch",
  "created at",
  "updated at",
]);

function cleanBlank(v: any) {
  const s = String(v ?? "").trim();
  return ["", "-", "n/a", "null"].includes(s.toLowerCase()) ? "" : s;
}

const DIRECT_FIELDS = [
  "full_name",
  "sex",
  "age",
  "birthday",
  "contact",
  "address",
  "email",
  "height_ft",
  "height_inch",
  "weight_kg",
  "systolic_bp",
  "diastolic_bp",
  "last_updated",
  "present_illness_history",
  "past_medical_history",
  "past_surgical_history",
  "chief_complaint",
  "allergies_text",
  "medications_current",
  "medications",
  "family_hx",
  "family_history",
];

const ALIASES: Record<string, string[]> = {
  // canonical : acceptable source keys
  smoking_hx: ["smoking_hx", "smoking", "smoking_history", "smokingHistory"],
  alcohol_hx: ["alcohol_hx", "alcohol", "alcohol_history", "alcoholHistory"],
};

function overlayPatient(base: any, extra: any) {
  if (!extra) return base;
  const dst: any = { ...base };

  // 1) copy direct fields if non-blank
  for (const f of DIRECT_FIELDS) {
    const cv = cleanBlank(extra?.[f]);
    if (cv) dst[f] = cv;
  }

  // 2) copy aliases into canonical keys (so UI can always read smoking_hx/alcohol_hx)
  for (const [canon, keys] of Object.entries(ALIASES)) {
    for (const k of keys) {
      const cv = cleanBlank(extra?.[k]);
      if (cv) { dst[canon] = cv; break; }
    }
  }

  return dst;
}

type ReportT = {
  patient: any;
  visit: any;
  sections: Array<{ name: string; items: any[] }>;
};

function buildReportForRowWithBranch(
  row: Row,
  rangeMap: Record<string, any[]>
): ReportT {
  const rep = buildReportForRow(row as any, rangeMap) as ReportT;

  // Ensure branch is part of the visit block
  const branch = String((row as any)?.branch ?? (rep?.visit as any)?.branch ?? "").trim();
  rep.visit = { ...(rep.visit || {}), branch };

  // Strip excluded keys/labels from all sections, then DROP empty sections
  rep.sections = (rep.sections || [])
    .map((sec: any) => {
      const items = (sec.items || []).filter((it: any) => {
        const k = String(it?.key || "").trim().toLowerCase();
        const lab = String(it?.label || "")
          .trim()
          .toLowerCase()
          .replace(/[_\-:.]+/g, " ")
          .replace(/\s+/g, " ");

        if (
          ["branch","created_at","updated_at","inserted_at","modified_at","created_at_utc","updated_at_utc"]
            .includes(k)
        ) return false;
        if (["branch","created at","updated at"].includes(lab)) return false;

        return true;
      });
      return { ...sec, items };
    })
    .filter((sec: any) => (sec.items && sec.items.length > 0)); // drop empty sections

  return rep; // ← IMPORTANT: explicitly return
}

/**
 * Build full API response for a patient (and optional date filter)
 */
async function buildResponse(patient_id: string, date?: string) {
  // Pull config + ranges
  const [cfg, ranges] = await Promise.all([sbReadConfig(), sbReadRanges()]);
  const rangeMap = buildRangeMap(ranges);

  // Pull results rows for this patient
  const rows = await sbReadResultsByPatient(patient_id);

  // Optional filter by exact visit date if supplied
  const filtered = date
    ? rows.filter((r) => String(r?.date_of_test ?? "") === String(date))
    : rows;

  // Build reports
  const reports: ReportT[] = filtered.map((r) =>
    buildReportForRowWithBranch(r, rangeMap)
  );

  // Overlay patient summary fields from Patients table (if any)
  const pat = await sbReadPatientById(patient_id);
  if (pat) {
    for (const rep of reports) {
      rep.patient = overlayPatient(rep.patient, pat);
    }
  }

  return { count: reports.length, reports, config: cfg || {} };
}

/**
 * POST: { patient_id, date? }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const patient_id = String(body?.patient_id || "").trim();
  const date = String(body?.date || "").trim();
  if (!patient_id) {
    return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });
  }
  try {
    const json = await buildResponse(patient_id, date || undefined);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/**
 * GET: /api/patient-results?patient_id=ID&date=YYYY-MM-DD (date optional)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const patient_id = String(searchParams.get("patient_id") || "").trim();
  const date = String(searchParams.get("date") || "").trim();
  if (!patient_id) {
    return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });
  }
  try {
    const json = await buildResponse(patient_id, date || undefined);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

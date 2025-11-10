// app/api/patient-results/route.ts
// TODO: move to /api/patients/[id]/reports

import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider-factory";
import { getSession } from "@/lib/session"; // patient portal session (unchanged)
import { getDoctorSession } from "@/lib/doctorSession";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- auth helpers ---------------- */
async function requireActor() {
  // 1) patient portal session (unchanged)
  try {
    const session = await getSession();
    if (session && session.role === "patient" && session.patient_id) {
      return { kind: "patient" as const, patient_id: String(session.patient_id) };
    }
  } catch {
    // ignore — not a patient portal call
  }

  // 2) staff cookie (if you later add staff)
  const c = await cookies();
  const staffId = c.get("staff_id")?.value;
  if (staffId) return { kind: "staff" as const, id: staffId };

  // 3) doctor cookie/JWT
  const doc = await getDoctorSession().catch(() => null);
  if (doc?.doctorId) return { kind: "doctor" as const, id: doc.doctorId, branch: doc.branch };

  return null;
}

/* ---------------- utils ---------------- */
function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const s = String(x).replace(/,/g, "").trim();
  if (!s || s === "-" || s.toLowerCase() === "n/a") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function asStr(x: any): string {
  if (x === null || x === undefined) return "";
  const s = String(x);
  return s === "null" ? "" : s;
}
function coerceFlag(f: any): "" | "L" | "H" | "A" {
  if (!f) return "";
  const u = String(f).toUpperCase();
  return u === "L" || u === "H" || u === "A" ? (u as any) : "";
}
// Parse common date formats→timestamp (ISO and M/D/YYYY or D/M/YYYY)
function ts(d: string | null | undefined): number {
  if (!d) return 0;
  const s = String(d).trim();
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return t;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const a = parseInt(m[1], 10); // a/b could be month/day or day/month
    const b = parseInt(m[2], 10);
    const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    const isDMY = a > 12;
    const month = (isDMY ? b : a) - 1;
    const day   = isDMY ? a : b;
    return new Date(y, month, day).getTime();
  }
  return 0;
}

function logRequest(method: "GET" | "POST", patient_id: string, reports: any[]) {
  try {
    console.log(JSON.stringify({
      route: "patient-results",
      method,
      patient_id,
      count: reports.length,
      dates: reports.map(r => r?.visit?.date_of_test).filter(Boolean),
    }));
  } catch {}
}

/* ---------- adapters to UI shape ---------- */
function adaptPatientForUI(p: any) {
  const vitals = adaptVitalsBlock(p?.vitals);
  return {
    patient_id: asStr(p?.patient_id),
    full_name:  asStr(p?.full_name),
    age:        asStr(p?.age),
    sex:        asStr(p?.sex),
    birthday:   asStr(p?.birthday),
    contact:    asStr(p?.contact),
    address:    asStr(p?.address),
    email:      asStr(p?.email),

    height_ft:    asStr(p?.height_ft),
    height_inch:  asStr(p?.height_inch),
    weight_kg:    asStr(p?.weight_kg),
    systolic_bp:  asStr(p?.systolic_bp),
    diastolic_bp: asStr(p?.diastolic_bp),

    last_updated: asStr(p?.last_updated),

    present_illness_history: asStr(p?.present_illness_history),
    past_medical_history:    asStr(p?.past_medical_history),
    past_surgical_history:   asStr(p?.past_surgical_history),
    chief_complaint:         asStr(p?.chief_complaint),
    allergies_text:          asStr(p?.allergies_text),

    medications_current:     asStr(p?.medications_current),
    medications:             asStr(p?.medications ?? p?.medications_current),

    family_hx:       asStr(p?.family_hx ?? p?.family_history),
    family_history:  asStr(p?.family_history ?? p?.family_hx),

    smoking_hx: asStr(p?.smoking_hx),
    alcohol_hx: asStr(p?.alcohol_hx),
    vitals,
  };
}

function adaptVitalsSnapshot(v: any) {
  if (!v) return null;
  return {
    id: asStr(v?.id),
    patient_id: asStr(v?.patient_id),
    consultation_id: asStr(v?.consultation_id),
    encounter_id: asStr(v?.encounter_id),
    measured_at: asStr(v?.measured_at),
    systolic_bp: toNum(v?.systolic_bp),
    diastolic_bp: toNum(v?.diastolic_bp),
    hr: toNum(v?.hr),
    rr: toNum(v?.rr),
    temp_c: toNum(v?.temp_c),
    height_cm: toNum(v?.height_cm),
    weight_kg: toNum(v?.weight_kg),
    bmi: toNum(v?.bmi),
    o2sat: toNum(v?.o2sat),
    notes: asStr(v?.notes),
    source: asStr(v?.source),
    created_at: asStr(v?.created_at),
    created_by_initials: asStr(v?.created_by_initials),
  };
}

function adaptVitalsBlock(v: any) {
  if (!v) return undefined;
  const latest = adaptVitalsSnapshot(v.latest);
  const history = Array.isArray(v.history)
    ? v.history.map((item: any) => adaptVitalsSnapshot(item)).filter(Boolean)
    : [];
  if (!latest && history.length === 0) return undefined;
  return { latest, history };
}

function adaptReportForUI(report: any) {
  return {
    patient: adaptPatientForUI(report?.patient),
    visit: {
      date_of_test: asStr(report?.visit?.date_of_test),
      barcode:      asStr(report?.visit?.barcode),
      notes:        asStr(report?.visit?.notes),
      branch:       asStr(report?.visit?.branch),
    },
    sections: (report?.sections || []).map((sec: any) => {
      const name = asStr(sec?.name);
      const hideRF = name === "Urinalysis" || name === "Fecalysis";
      return {
        name,
        items: (sec?.items || []).map((it: any) => {
          const lowNum  = toNum(it?.ref_low);
          const highNum = toNum(it?.ref_high);
          return {
            key:   asStr(it?.key),
            label: asStr(it?.label),
            value: asStr(it?.value),
            unit:  asStr(it?.unit),
            flag:  hideRF ? "" : coerceFlag(it?.flag),
            ref: hideRF ? undefined : {
              low:  lowNum === null ? undefined : lowNum,
              high: highNum === null ? undefined : highNum,
            },
          };
        }).filter((it: any) => it.value && it.value.trim() !== ""),
      };
    }).filter((s: any) => s.items.length > 0),
  };
}

/* -------- build all reports for a patient -------- */
async function buildAllReports(patient_id: string, limit?: number, specificDate?: string) {
  const provider = await getDataProvider();
  const visits = await provider.getVisits(patient_id);

  const dates = specificDate
    ? visits.filter(v => v.date_of_test === specificDate).map(v => v.date_of_test)
    : visits.map(v => v.date_of_test);

  const sorted = [...dates].sort((a, b) => ts(b) - ts(a)); // newest → oldest
  const trimmed = typeof limit === "number" ? sorted.slice(0, limit) : sorted;

  const reports: any[] = [];
  for (const d of trimmed) {
    const rep = await provider.getReport({ patient_id, visitDate: d });
    if (rep) reports.push(adaptReportForUI(rep));
  }
  const config = (await provider.getConfig?.()) ?? {};
  return { reports, config };
}

/* --------------- handlers --------------- */
// POST: patient portal (session) OR doctor/staff (provide patientId in body)
export async function POST(req: Request) {
  try {
    const actor = await requireActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const visitDate  = body?.visitDate ? String(body.visitDate) : undefined;
    const limit      = body?.limit != null ? Number(body.limit) : undefined;

    // Make patient_id a definite string before use
    let patient_id: string | null = null;

    if (actor.kind === "patient") {
      patient_id = actor.patient_id;
    } else {
      // doctor or staff must specify the patient
      const fromBody =
        (body?.patientId && String(body.patientId)) ||
        (body?.patient_id && String(body.patient_id)) ||
        "";
      if (!fromBody) {
        return NextResponse.json({ error: "patientId required" }, { status: 400 });
      }
      patient_id = fromBody;
    }

    const pid = patient_id as string; // TS-safe now
    const json = await buildAllReports(pid, limit, visitDate);
    logRequest("POST", pid, json.reports);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// GET: patient portal (session) OR doctor/staff (?patient_id=..., &date=..., &limit=...)
export async function GET(req: Request) {
  try {
    const actor = await requireActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const visitDate  = (searchParams.get("date") ?? undefined) || undefined;
    const limitParam = searchParams.get("limit");
    const limit      = limitParam != null ? Number(limitParam) : undefined;

    let patient_id: string | null = null;

    if (actor.kind === "patient") {
      patient_id = actor.patient_id;
    } else {
      // doctor or staff must specify the patient in query
      const q = searchParams.get("patient_id") || searchParams.get("pid") || "";
      if (!q) {
        return NextResponse.json({ error: "patient_id query param required" }, { status: 400 });
      }
      patient_id = q;
    }

    const pid = patient_id as string; // TS-safe now
    const json = await buildAllReports(pid, limit, visitDate);
    logRequest("GET", pid, json.reports);
    return NextResponse.json(json, { status: 200 }); 
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// app/api/results/route.ts | depreciated use /api/patient-results
import { NextResponse } from "next/server";
import {
  readResults, readRanges, readConfig, readPatients,
  buildRangeMap, filterByPatientId, filterByDate, buildReportForRow
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

function withDeprecation<T extends (...args: any[]) => Promise<Response>>(fn: T): T {
  return (async (...args: any[]) => {
    const res = await fn(...args);
    const headers = new Headers(res.headers);
    headers.set("Deprecation", "true");
    headers.set("Sunset", "2025-12-31"); // date you plan to remove it
    headers.set("Link", '</api/patient-results>; rel="successor-version"');
    console.warn("[DEPRECATED] /api/results and /api/report -> use /api/patient-results instead.");
    return new Response(await res.text(), { status: res.status, headers });
  }) as T;
}

function overlayPatientFromPatients(base: any, extra: any) {
  if (!extra) return base;
  const dst = { ...base };
  const fields = [
    "full_name","sex","age","birthday","contact","address",
    "email","height_ft","height_inch","weight_kg","systolic_bp","diastolic_bp",
    "smoking_hx","alcohol_hx",
    "chief_complaint","present_illness_history","past_medical_history",
    "past_surgical_history","allergies_text","medications_current","medications",
    "family_hx","family_history","last_updated"
  ];
  for (const k of fields) {
    const v = extra[k];
    if (v !== undefined && String(v).trim() !== "") (dst as any)[k] = String(v);
  }
  return dst;
}

export const POST = withDeprecation(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const patient_id = String(body?.patient_id || "").trim();
  const date = String(body?.date || "").trim();
  if (!patient_id) return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });

  try {
    const [results, ranges, cfg, patients] = await Promise.all([
      readResults(), readRanges(), readConfig(), readPatients()
    ]);
    const rmap = buildRangeMap(ranges);

    const px = new Map<string, any>();
    for (const p of patients) {
      const id = String(p.patient_id || "").trim().toLowerCase();
      if (id) px.set(id, p);
    }

    const rows = filterByDate(filterByPatientId(results, patient_id), date);
    const reports = rows.map(r => {
      const rep = buildReportForRow(r, rmap);
      const extra = px.get(String(rep.patient.patient_id || "").trim().toLowerCase());
      rep.patient = overlayPatientFromPatients(rep.patient, extra);
      return rep;
    });

    return NextResponse.json({ count: reports.length, reports, config: cfg });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
})

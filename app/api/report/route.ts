// app/api/report/route.ts
import { NextResponse } from "next/server";
import {
  readResults,
  readRanges,
  readConfig,
  readPatients,            // ← NEW
  buildRangeMap,
  filterByPatientId,
  filterByDate,
  buildReportForRow,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

// tiny helper to keep logs anonymous
async function safeHash(s: string) {
  try {
    const buf = new TextEncoder().encode(s);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 8);
  } catch {
    return "hasherr";
  }
}

/**
 * Merge optional fields from Patients tab into the base patient block.
 * Keys are tolerant (aliases supported) and only non-empty values overwrite.
 */
function mergePatientExtra(base: any, extra: any) {
  const out = { ...base };

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = extra?.[k];
      if (v !== undefined && String(v).trim() !== "") return v;
    }
    return undefined;
  };
  const set = (dstKey: string, ...aliases: string[]) => {
    const v = pick(...aliases);
    if (v !== undefined) (out as any)[dstKey] = v;
  };

  // Contact-like (we intentionally don't override contact/address here;
  // those already come from Results. Uncomment if you *want* Patients to win.)
  set("email", "email");

  // Vitals
  set("height_ft", "height_ft", "ht_ft");
  set("height_inch", "height_inch", "ht_inch");
  set("weight_kg", "weight_kg", "wt_kg");
  set("systolic_bp", "systolic_bp", "bp_sys", "bp_systolic");
  set("diastolic_bp", "diastolic_bp", "bp_dia", "bp_diastolic");

  // Lifestyle
  set("smoking_hx", "smoking_hx");
  set("alcohol_hx", "alcohol_hx");

  // Narratives
  set("chief_complaint", "chief_complaint", "chief");
  set("present_illness_history", "present_illness_history", "present_illness", "hpi");
  set("past_medical_history", "past_medical_history", "past_medical_hi", "pmh");
  set("past_surgical_history", "past_surgical_history", "past_surgical_hi", "psh");
  set("allergies_text", "allergies_text", "allergies");
  set("medications_current", "medications_current", "medications_cur");
  set("family_hx", "family_hx", "family_history");
  set("medications", "medications");

  // Meta
  set("last_updated", "last_updated");

  return out;
}

export async function GET(req: Request) {
  const __start = Date.now();
  const { searchParams } = new URL(req.url);
  const patient_id = searchParams.get("patient_id") || "";
  const date = searchParams.get("date") || "";

  if (!patient_id) {
    try {
      console.log("[api:report] missing patient_id in %dms", Date.now() - __start);
    } catch {}
    return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });
  }

  try {
    // Core sheets
    const [results, ranges, config] = await Promise.all([
      readResults(),
      readRanges(),
      readConfig(),
    ]);

    // Optional Patients sheet (don’t fail the endpoint if missing)
    let patientsRows: any[] = [];
    try {
      patientsRows = await readPatients();
    } catch {
      patientsRows = [];
    }
    const patientsById = new Map<string, any>();
    for (const r of patientsRows) {
      const key = String(r?.patient_id || "").trim().toLowerCase();
      if (!key) continue;
      // first one wins; or replace with logic using last_updated if you prefer
      if (!patientsById.has(key)) patientsById.set(key, r);
    }

    const rmap = buildRangeMap(ranges);
    const rows = filterByDate(filterByPatientId(results, patient_id), date);

    const reports = rows.map(r => {
      const rep = buildReportForRow(r, rmap);
      const pidKey = String(rep.patient?.patient_id || "").trim().toLowerCase();
      const extra = patientsById.get(pidKey);
      if (extra) {
        rep.patient = mergePatientExtra(rep.patient, extra);
      }
      return rep;
    });

    try {
      const pid = await safeHash(patient_id);
      console.log(
        "[api:report] ok %s %d report(s) in %dms",
        pid,
        reports.length,
        Date.now() - __start
      );
    } catch {}

    return NextResponse.json({ count: reports.length, reports, config });
  } catch (e: any) {
    try {
      const pid = patient_id ? await safeHash(patient_id) : "none";
      console.log("[api:report] fail %s in %dms", pid, Date.now() - __start);
    } catch {}
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
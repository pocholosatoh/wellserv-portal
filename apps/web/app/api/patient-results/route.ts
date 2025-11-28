// app/api/patient-results/route.ts
// TODO: move to /api/patients/[id]/reports

import { NextResponse } from "next/server";
import { buildAllReports } from "@/lib/api/patient-results-core";
import { requireActor } from "@/lib/api-actor";
export { buildAllReports, adaptReportForUI } from "@/lib/api/patient-results-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

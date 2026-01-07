// app/api/patient-results/route.ts
// TODO: move to /api/patients/[id]/reports

import { NextResponse } from "next/server";
import { buildAllReports } from "@/lib/api/patient-results-core";
import { guard } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logRequest(method: "GET" | "POST", patient_id: string, reports: any[]) {
  try {
    console.log(
      JSON.stringify({
        route: "patient-results",
        method,
        patient_id,
        count: reports.length,
        dates: reports.map((r) => r?.visit?.date_of_test).filter(Boolean),
      }),
    );
  } catch {}
}
/* --------------- handlers --------------- */
// POST: patient portal (session) OR doctor/staff (provide patientId in body)
export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["patient", "staff", "doctor"], requirePatientId: true });
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const visitDate = body?.visitDate ? String(body.visitDate) : undefined;
    const limit = body?.limit != null ? Number(body.limit) : undefined;

    const pid = auth.patientId as string;
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
    const auth = await guard(req, { allow: ["patient", "staff", "doctor"], requirePatientId: true });
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const visitDate = (searchParams.get("date") ?? undefined) || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam != null ? Number(limitParam) : undefined;

    const pid = auth.patientId as string;
    const json = await buildAllReports(pid, limit, visitDate);
    logRequest("GET", pid, json.reports);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

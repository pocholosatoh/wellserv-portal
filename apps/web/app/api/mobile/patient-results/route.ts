import { NextResponse } from "next/server";
import { buildAllReports } from "@/lib/api/patient-results-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAccessAllowed(code: string | undefined | null) {
  const expected =
    process.env.PATIENT_PORTAL_ACCESS_CODE ||
    process.env.PATIENT_ACCESS_CODE;
  if (!expected) return true;
  return code === expected;
}

// Minimal mobile-friendly endpoint that reuses buildAllReports and returns the same shape
// as /api/patient-results. It is gated by the patient portal access code so mobile apps
// must provide it in the request body.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const patientId = body?.patientId || body?.patient_id;
    const limit = body?.limit != null ? Number(body.limit) : undefined;
    const visitDateRaw = body?.visitDate || body?.visit_date || body?.date;
    const visitDate = visitDateRaw ? String(visitDateRaw) : undefined;
    const accessCode = body?.accessCode || body?.access_code;

    if (!patientId) {
      return NextResponse.json({ error: "patientId required" }, { status: 400 });
    }

    if (!isAccessAllowed(accessCode)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pid = String(patientId).trim();
    const json = await buildAllReports(pid, limit, visitDate);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

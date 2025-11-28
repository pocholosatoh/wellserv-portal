import { NextResponse } from "next/server";
import { getPatientPrescriptions } from "@/lib/api/patient-prescriptions-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAccessAllowed(code: string | undefined | null) {
  const expected =
    process.env.PATIENT_PORTAL_ACCESS_CODE ||
    process.env.PATIENT_ACCESS_CODE;
  if (!expected) return true;
  return code === expected;
}

// Minimal mobile-friendly endpoint that reuses the same data access as the patient portal.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const patientId = body?.patientId || body?.patient_id;
    const accessCode = body?.accessCode || body?.access_code;

    if (!patientId) {
      return NextResponse.json({ error: "patientId required" }, { status: 400 });
    }

    if (!isAccessAllowed(accessCode)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pid = String(patientId).trim();
    const json = await getPatientPrescriptions(pid);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

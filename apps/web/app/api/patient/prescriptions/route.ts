// app/api/patient/prescriptions/route.ts
// Returns all SIGNED prescriptions for a patient (newest first).
// Supports patient portal (session) and doctor/staff (provide patient_id).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { getSession } from "@/lib/session";
import { getPatientPrescriptions } from "@/lib/api/patient-prescriptions-core";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Patient portal sessions should still work even if doctor/staff cookies exist.
    const session = await getSession().catch(() => null);
    const sessionPatientId =
      session?.role === "patient" && session.patient_id ? String(session.patient_id) : null;

    if (sessionPatientId) {
      const json = await getPatientPrescriptions(sessionPatientId);
      return NextResponse.json(json);
    }

    const auth = await guard(req, { allow: ["patient", "staff", "doctor"], requirePatientId: true });
    if (!auth.ok) return auth.response;

    const json = await getPatientPrescriptions(auth.patientId as string);
    return NextResponse.json(json);
  } catch (e: any) {
    console.error("[patient/prescriptions] unexpected:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

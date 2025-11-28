// app/api/patient/prescriptions/route.ts
// Returns all SIGNED prescriptions for a patient (newest first).
// Supports patient portal (session) and doctor/staff (provide patient_id).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireActor, getTargetPatientId } from "@/lib/api-actor";
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

    // Accept patient portal, doctor, or staff (requires patient_id)
    const actor = await requireActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve patient_id:
    // - patient portal: from session
    // - doctor/staff:   from query ?patient_id= or ?pid=
    const patient_id =
      actor.kind === "patient" ? actor.patient_id : getTargetPatientId(actor, { searchParams });

    if (!patient_id) {
      return NextResponse.json(
        { error: "patient_id required" },
        { status: 400 }
      );
    }

    const json = await getPatientPrescriptions(patient_id);
    return NextResponse.json(json);
  } catch (e: any) {
    console.error("[patient/prescriptions] unexpected:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

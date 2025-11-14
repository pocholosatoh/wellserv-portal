// app/api/prescriptions/delete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor } from "@/lib/api-actor"; // ← accept doctor or staff

type DeleteBody = {
  prescriptionId?: string;
  consultationId?: string;
};

export async function POST(req: Request) {
  try {
    const actor = await requireActor();
    if (!actor || actor.kind === "patient") {
      // Patients must not be able to delete prescriptions
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: DeleteBody = await req.json().catch(() => ({} as DeleteBody));
    const prescriptionId = (body?.prescriptionId || "").trim();
    const consultationId = (body?.consultationId || "").trim();

    if (!prescriptionId && !consultationId) {
      return NextResponse.json(
        { error: "prescriptionId or consultationId is required" },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // 1) Locate the target draft prescription
    let rxId: string | null = null;
    let rxDoctorId: string | null = null;
    let rxStatus: string | null = null;

    if (prescriptionId) {
      const { data, error } = await db
        .from("prescriptions")
        .select("id, doctor_id, status")
        .eq("id", prescriptionId)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ ok: true }); // nothing to delete

      rxId = data.id;
      rxDoctorId = data.doctor_id ?? null;
      rxStatus = data.status ?? null;
    } else {
      // by consultationId: find a DRAFT under that consult
      const { data, error } = await db
        .from("prescriptions")
        .select("id, doctor_id, status")
        .eq("consultation_id", consultationId)
        .eq("status", "draft")
        .limit(1)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ ok: true }); // nothing to delete

      rxId = data.id;
      rxDoctorId = data.doctor_id ?? null;
      rxStatus = data.status ?? null;
    }

    // 2) Only allow deleting DRAFT
    if (rxStatus !== "draft") {
      return NextResponse.json(
        { error: "Only DRAFT prescriptions can be deleted" },
        { status: 400 }
      );
    }

    // 3) If actor is DOCTOR and prescription has a doctor_id, enforce ownership
    if (actor.kind === "doctor" && rxDoctorId && rxDoctorId !== actor.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4) Delete items first (unless you have FK ON DELETE CASCADE)
    const delItems = await db
      .from("prescription_items")
      .delete()
      .eq("prescription_id", rxId!);
    if (delItems.error) {
      return NextResponse.json({ error: delItems.error.message }, { status: 400 });
    }

    // 5) Delete the prescription
    const delRx = await db.from("prescriptions").delete().eq("id", rxId!);
    if (delRx.error) {
      return NextResponse.json({ error: delRx.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

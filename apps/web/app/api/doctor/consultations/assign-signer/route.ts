// app/api/doctor/consultations/assign-signer/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor } from "@/lib/api-actor";

type Body = {
  consultation_id: string;
  signing_doctor_id: string; // a real doctor from public.doctors
};

export async function POST(req: Request) {
  try {
    const actor = await requireActor();
    if (!actor || actor.kind === "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { consultation_id, signing_doctor_id } = (await req.json().catch(() => ({}))) as Body;
    if (!consultation_id || !signing_doctor_id) {
      return NextResponse.json({ error: "consultation_id and signing_doctor_id are required" }, { status: 400 });
    }

    const db = getSupabase();

    // Load the doctor’s identifiers (must be active)
    const { data: doc, error: dErr } = await db
      .from("doctors")
      .select("doctor_id, display_name, full_name, credentials, prc_no, philhealth_md_id, active")
      .eq("doctor_id", signing_doctor_id)
      .maybeSingle();
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 400 });
    if (!doc || doc.active === false) return NextResponse.json({ error: "Doctor not found or inactive" }, { status: 400 });

    const baseName = doc.display_name || doc.full_name || "";
    const display  = doc.credentials ? `${baseName}, ${doc.credentials}` : baseName;

    // Snapshot onto the consultation
    const { error: uErr } = await db
      .from("consultations")
      .update({
        signing_doctor_id: doc.doctor_id,
        signing_doctor_name: display || baseName || null,
        signing_doctor_prc_no: doc.prc_no || null,
        signing_doctor_philhealth_md_id: doc.philhealth_md_id || null,
      })
      .eq("id", consultation_id);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

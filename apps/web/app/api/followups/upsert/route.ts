// app/api/followups/upsert/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

function isUuid(v?: string | null) {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function POST(req: Request) {
  try {
    const supa = getSupabase();
    const body = await req.json();

    const {
      patient_id,
      created_from_consultation_id,
      return_branch,
      due_date, // "YYYY-MM-DD"
      intended_outcome = "",
      expected_tests = "",
      tolerance_days = 7,
      created_by = null,
      updated_by = null,
    } = body || {};

    if (!patient_id || !created_from_consultation_id || !due_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const auth = await guard(req, { allow: ["doctor", "staff"], requireBranch: true });
    if (!auth.ok) return auth.response;
    const actor = auth.actor;
    const actorDoctorId = actor && actor.kind === "doctor" && isUuid(actor.id) ? actor.id : null;
    const createdBy = created_by ?? actorDoctorId ?? null;
    const updatedBy = updated_by ?? actorDoctorId ?? createdBy ?? null;

    // Close any existing scheduled as canceled_rescheduled (to keep exactly one active)
    await supa.rpc("noop"); // harmless ping to ensure connection; optional

    const cancelPayload: Record<string, any> = {
      status: "canceled",
      cancel_reason: "canceled_rescheduled",
    };
    if (updatedBy) cancelPayload.updated_by = updatedBy;

    await supa
      .from("followups")
      .update(cancelPayload)
      .eq("patient_id", patient_id)
      .eq("status", "scheduled");

    // Insert new scheduled follow-up
    const { data, error } = await supa
      .from("followups")
      .insert([
        {
          patient_id,
          created_from_consultation_id,
          return_branch,
          due_date,
          intended_outcome,
          expected_tests,
          tolerance_days,
          status: "scheduled",
          created_by: createdBy,
          updated_by: updatedBy,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ followup: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

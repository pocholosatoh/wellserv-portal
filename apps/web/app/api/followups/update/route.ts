// app/api/followups/update/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor } from "@/lib/api-actor";

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
      followup_id,
      patient_id,
      due_date,
      return_branch,
      intended_outcome = "",
      expected_tests = "",
      updated_by = null,
    } = body || {};

    if (!followup_id || !patient_id || !due_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const actor = await requireActor().catch(() => null);
    const actorDoctorId = actor && actor.kind === "doctor" && isUuid(actor.id) ? actor.id : null;
    const updatedBy = updated_by ?? actorDoctorId ?? null;

    const payload: Record<string, any> = {
      due_date,
      return_branch,
      intended_outcome,
      expected_tests,
      updated_at: new Date().toISOString(),
    };
    if (updatedBy) payload.updated_by = updatedBy;

    const { data, error } = await supa
      .from("followups")
      .update(payload)
      .eq("id", followup_id)
      .eq("patient_id", patient_id)
      .eq("status", "scheduled")
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ followup: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

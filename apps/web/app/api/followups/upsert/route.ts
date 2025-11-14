// app/api/followups/upsert/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const supa = getSupabase();
    const body = await req.json();

    const {
      patient_id,
      created_from_consultation_id,
      return_branch,
      due_date,                // "YYYY-MM-DD"
      intended_outcome = "",
      expected_tests = "",
      tolerance_days = 7,
      created_by = null,
    } = body || {};

    if (!patient_id || !created_from_consultation_id || !due_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Close any existing scheduled as canceled_rescheduled (to keep exactly one active)
    await supa.rpc("noop"); // harmless ping to ensure connection; optional

    await supa
      .from("followups")
      .update({ status: "canceled", cancel_reason: "canceled_rescheduled", updated_by: created_by })
      .eq("patient_id", patient_id)
      .eq("status", "scheduled");

    // Insert new scheduled follow-up
    const { data, error } = await supa
      .from("followups")
      .insert([{
        patient_id,
        created_from_consultation_id,
        return_branch,
        due_date,
        intended_outcome,
        expected_tests,
        tolerance_days,
        status: "scheduled",
        created_by,
        updated_by: created_by,
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ followup: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

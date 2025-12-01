// app/api/followups/update/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

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

    const { data, error } = await supa
      .from("followups")
      .update({
        due_date,
        return_branch,
        intended_outcome,
        expected_tests,
        updated_by,
        updated_at: new Date().toISOString(),
      })
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

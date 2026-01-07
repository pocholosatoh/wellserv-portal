// app/api/followups/reschedule/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const supa = getSupabase();
    const body = await req.json();
    const {
      followup_id,
      patient_id,
      created_from_consultation_id, // keep original or set to the recent consult that triggered the resched
      new_due_date, // YYYY-MM-DD
      return_branch, // optional override
      intended_outcome, // optional carry-over
      expected_tests, // optional carry-over
      updated_by = null,
    } = body || {};

    if (!followup_id || !patient_id || !created_from_consultation_id || !new_due_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Close old
    const { error: upErr } = await supa
      .from("followups")
      .update({ status: "canceled", cancel_reason: "canceled_rescheduled", updated_by })
      .eq("id", followup_id)
      .eq("status", "scheduled");
    if (upErr) throw upErr;

    // Insert new
    const { data: inserted, error: insErr } = await supa
      .from("followups")
      .insert([
        {
          patient_id,
          created_from_consultation_id,
          due_date: new_due_date,
          return_branch,
          intended_outcome,
          expected_tests,
          status: "scheduled",
          updated_by,
        },
      ])
      .select()
      .single();
    if (insErr) throw insErr;

    return NextResponse.json({ followup: inserted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

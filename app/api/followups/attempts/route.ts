// app/api/followups/attempts/log/route.ts
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
      channel,        // call | sms | messenger | email | other
      outcome,        // reached_confirmed | reached_declined | no_answer | wrong_number | callback_requested | other
      notes = "",
      attempted_by_name = null,
      staff_id = null, // v1.5 usage
    } = body || {};

    if (!followup_id || !channel || !outcome) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supa
      .from("followup_attempts")
      .insert([{ followup_id, channel, outcome, notes, attempted_by_name, staff_id }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ attempt: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// app/api/followups/attach/route.ts
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
      closed_by_consultation_id,
      completion_note = null,
      updated_by = null,
    } = body || {};

    if (!followup_id || !closed_by_consultation_id) {
      return NextResponse.json({ error: "Missing followup_id or closed_by_consultation_id" }, { status: 400 });
    }

    const { data, error } = await supa
      .from("followups")
      .update({
        status: "completed",
        closed_by_consultation_id,
        completion_note,
        updated_by,
        updated_at: new Date().toISOString(),
      })
      .eq("id", followup_id)
      .eq("status", "scheduled")
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ followup: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

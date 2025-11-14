// app/api/followups/cancel/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const supa = getSupabase();
    const { followup_id, reason = "other", updated_by = null } = await req.json();

    if (!followup_id) {
      return NextResponse.json({ error: "Missing followup_id" }, { status: 400 });
    }

    const { data, error } = await supa
      .from("followups")
      .update({
        status: "canceled",
        cancel_reason: reason,
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

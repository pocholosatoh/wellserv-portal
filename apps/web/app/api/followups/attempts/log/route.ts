import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { guard } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const followup_id = String(body?.followup_id || "").trim();
    const channel = String(body?.channel || "").trim();
    const outcome = String(body?.outcome || "").trim();
    const notes = body?.notes != null ? String(body.notes) : null;
    const attempted_by_name = body?.attempted_by_name ? String(body.attempted_by_name) : null;

    if (!followup_id) return NextResponse.json({ error: "followup_id required" }, { status: 400 });
    if (!channel) return NextResponse.json({ error: "channel required" }, { status: 400 });
    if (!outcome) return NextResponse.json({ error: "outcome required" }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("followup_attempts")
      .insert({
        followup_id,
        channel,
        outcome,
        notes,
        attempted_by_name,
        staff_id: null, // optional: attach a staff UUID if you have it
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, attempt: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

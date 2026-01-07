import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { guard } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const fid = String(searchParams.get("followup_id") || "").trim();
    if (!fid) return NextResponse.json({ error: "followup_id required" }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("followup_attempts")
      .select("id, attempted_at, channel, outcome, notes, attempted_by_name")
      .eq("followup_id", fid)
      .order("attempted_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ attempts: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

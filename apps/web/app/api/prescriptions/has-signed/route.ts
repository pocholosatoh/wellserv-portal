import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const sb = getSupabase();
    const { searchParams } = new URL(req.url);
    const cid = (searchParams.get("consultation_id") || "").trim();
    if (!cid) return NextResponse.json({ error: "consultation_id required" }, { status: 400 });

    const { data: rx } = await sb
      .from("prescriptions")
      .select("id")
      .eq("consultation_id", cid)
      .eq("status", "signed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ hasSigned: !!rx?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor", "staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ items: [] });

    const db = getSupabase();

    // Prefer code exact starts-with; then title ILIKE; small page
    const { data, error } = await db
      .from("icd10")
      .select("code, title")
      .or(`code.ilike.${q.replace(/%/g, "")}%,title.ilike.%${q}%`)
      .order("code", { ascending: true })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const consultation_id = (url.searchParams.get("consultation_id") || "").trim();
    if (!consultation_id) {
      return NextResponse.json({ error: "consultation_id is required" }, { status: 400 });
    }

    const db = getSupabase();
    const sel = "id, consultation_id, icd10_code, icd10_text_snapshot, is_primary";

    const { data, error } = await db
      .from("consultation_diagnoses")
      .select(sel)
      .eq("consultation_id", consultation_id)
      .order("is_primary", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Map to the shape your client expects (code/title)
    const items = (data || []).map((r) => ({
      id: r.id,
      consultation_id: r.consultation_id,
      code: r.icd10_code,
      title: r.icd10_text_snapshot,
      is_primary: !!r.is_primary,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const db = supa();
    const { data: enc, error } = await db
      .from("encounters")
      .select("id,patient_id,branch_code,notes_frontdesk,price_manual_add,price_auto_total,total_price")
      .eq("id", id)
      .single();
    if (error) throw error;

    return NextResponse.json({ row: enc });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"] });
    if (!auth.ok) return auth.response;
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const db = getSupabase();
    const { data: enc, error } = await db
      .from("encounters")
      .select(
        "id,patient_id,branch_code,notes_frontdesk,price_manual_add,price_auto_total,total_price,discount_enabled",
      )
      .eq("id", id)
      .single();
    if (error) throw error;

    return NextResponse.json({ row: enc });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

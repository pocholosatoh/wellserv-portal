import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"] });
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const fullName = String(url.searchParams.get("full_name") || "").trim();
    const birthday = String(url.searchParams.get("birthday") || "").trim();

    if (!fullName || !birthday) {
      return NextResponse.json({ match: null }, { status: 400 });
    }

    const db = getSupabase();
    const { data, error } = await db
      .from("patients")
      .select("patient_id, full_name, birthday")
      .eq("full_name", fullName)
      .eq("birthday", birthday)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const match = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return NextResponse.json({ match });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

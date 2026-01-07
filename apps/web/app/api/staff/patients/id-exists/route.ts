import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"] });
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const patientId = String(url.searchParams.get("patient_id") || "").trim();
    if (!patientId) {
      return NextResponse.json({ exists: false, error: "patient_id required" }, { status: 400 });
    }

    const db = getSupabase();
    const { count, error } = await db
      .from("patients")
      .select("patient_id", { count: "exact", head: true })
      .eq("patient_id", patientId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ exists: (count ?? 0) > 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"], requirePatientId: true });
    if (!auth.ok) return auth.response;

    const patientId = String(auth.patientId || "").trim();
    if (!patientId) {
      return NextResponse.json({ error: "patient_id required" }, { status: 400 });
    }

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") || 12);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 12;

    const db = getSupabase();
    const { data, error } = await db
      .from("encounters")
      .select("id, visit_date_local, branch_code, status, queue_number")
      .eq("patient_id", patientId)
      .order("visit_date_local", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

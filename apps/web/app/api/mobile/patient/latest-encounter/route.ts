import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["patient"], allowMobileToken: true, requirePatientId: true });
    if (!auth.ok) return auth.response;

    const supa = getSupabase();
    const pid = escapeLikeExact(String(auth.patientId || "").trim());

    const { data, error } = await supa
      .from("encounters")
      .select("id, created_at")
      .ilike("patient_id", pid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ encounter_id: data?.id ?? null }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

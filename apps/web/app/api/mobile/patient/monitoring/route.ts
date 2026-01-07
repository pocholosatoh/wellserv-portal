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
      .from("patient_self_monitoring")
      .select("*")
      .ilike("patient_id", pid);

    if (error) throw error;

    return NextResponse.json({ monitoring: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

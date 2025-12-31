import { NextResponse } from "next/server";
import { getMobilePatient } from "@/lib/mobileAuth";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

export async function GET(req: Request) {
  try {
    const actor = await getMobilePatient(req);
    if (!actor?.patient_id) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const supa = getSupabase();
    const pid = escapeLikeExact(String(actor.patient_id || "").trim());

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

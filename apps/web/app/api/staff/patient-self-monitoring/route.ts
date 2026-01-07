export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

function normalizePatientId(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"], requirePatientId: true });
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const patientId = normalizePatientId(auth.patientId);

    const supa = getSupabase();
    const pid = escapeLikeExact(patientId);

    const { data, error } = await supa
      .from("patient_self_monitoring")
      .select("*")
      .ilike("patient_id", pid)
      .order("parameter_key", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ monitoring: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

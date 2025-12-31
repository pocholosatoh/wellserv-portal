export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

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
    const s = await getSession();
    if (!s || s.role !== "staff") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const patientId = normalizePatientId(
      searchParams.get("patient_id") || searchParams.get("patientId"),
    );
    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

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

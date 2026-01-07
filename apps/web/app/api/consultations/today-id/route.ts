// app/api/consultations/today-id/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

function todayYMD(tz = process.env.APP_TZ || "Asia/Manila") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
}

export async function GET(req: Request) {
  try {
    const auth = await guard(req, {
      allow: ["doctor"],
      requireBranch: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const patientId = String(auth.patientId || "").trim();
    if (!patientId) {
      return NextResponse.json({ error: "patient_id required" }, { status: 400 });
    }

    const ymd = todayYMD(); // Asia/Manila (or APP_TZ)
    const start = `${ymd}T00:00:00+08:00`;
    const end = `${ymd}T23:59:59.999+08:00`;

    const db = getSupabase();
    // 🔑 Do NOT filter by branch; grab the latest today for this patient
    const { data, error } = await db
      .from("consultations")
      .select("id, visit_at")
      .eq("patient_id", patientId)
      .gte("visit_at", start)
      .lte("visit_at", end)
      .order("visit_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ consultation_id: data?.id || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

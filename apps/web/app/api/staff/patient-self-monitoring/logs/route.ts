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

    const limitRaw = Number(searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;

    const supa = getSupabase();
    const pid = escapeLikeExact(patientId);

    const base = () =>
      supa
        .from("vitals_snapshots")
        .select("id, measured_at, systolic_bp, diastolic_bp, weight_kg, blood_glucose_mgdl")
        .ilike("patient_id", pid)
        .eq("source", "patient")
        .order("measured_at", { ascending: false })
        .limit(limit);

    const [bpRes, weightRes, glucoseRes] = await Promise.all([
      base().or("systolic_bp.not.is.null,diastolic_bp.not.is.null"),
      base().not("weight_kg", "is", null),
      base().not("blood_glucose_mgdl", "is", null),
    ]);

    if (bpRes.error) throw bpRes.error;
    if (weightRes.error) throw weightRes.error;
    if (glucoseRes.error) throw glucoseRes.error;

    return NextResponse.json(
      {
        logs: {
          bp: bpRes.data ?? [],
          weight: weightRes.data ?? [],
          glucose: glucoseRes.data ?? [],
        },
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

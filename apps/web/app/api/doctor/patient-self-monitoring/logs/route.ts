export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";
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
    const auth = await guard(req, {
      allow: ["doctor"],
      requireBranch: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;

    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitRaw = searchParams.get("limit");
    const parsedLimit = limitRaw ? Number(limitRaw) : 10;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;
    const supa = getSupabase();
    const pid = escapeLikeExact(normalizePatientId(auth.patientId));

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

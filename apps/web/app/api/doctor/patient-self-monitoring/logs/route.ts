export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";

const QuerySchema = z.object({
  patient_id: z.string().min(1),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

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
    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      patient_id: searchParams.get("patient_id") || searchParams.get("patientId"),
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const limit = parsed.data.limit ?? 10;
    const supa = getSupabase();
    const pid = escapeLikeExact(normalizePatientId(parsed.data.patient_id));

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

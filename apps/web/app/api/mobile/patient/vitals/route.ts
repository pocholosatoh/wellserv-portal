import { NextResponse } from "next/server";
import { z } from "zod";
import { getMobilePatient } from "@/lib/mobileAuth";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParameterKeySchema = z.enum(["bp", "weight", "glucose"]);

const RequestSchema = z.object({
  parameter_key: ParameterKeySchema,
  measured_at: z.string().datetime().optional(),
  systolic_bp: z.union([z.number(), z.string()]).optional(),
  diastolic_bp: z.union([z.number(), z.string()]).optional(),
  weight_kg: z.union([z.number(), z.string()]).optional(),
  blood_glucose_mgdl: z.union([z.number(), z.string()]).optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATIENT_ID_KEYS = [
  "auth_user_id",
  "auth_user_uuid",
  "user_id",
  "user_uuid",
  "auth_id",
  "auth_uid",
  "uuid",
  "id",
];

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

function normalizePatientId(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function resolvePatientUserId(supa: ReturnType<typeof getSupabase>, patientId: string) {
  const pid = escapeLikeExact(patientId);
  const { data, error } = await supa
    .from("patients")
    .select("*")
    .ilike("patient_id", pid)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  for (const key of PATIENT_ID_KEYS) {
    const value = data[key];
    if (typeof value === "string" && UUID_RE.test(value)) {
      return value;
    }
  }

  return null;
}

async function fetchLatestEncounterId(supa: ReturnType<typeof getSupabase>, patientId: string) {
  const pid = escapeLikeExact(patientId);
  const { data, error } = await supa
    .from("encounters")
    .select("id, created_at")
    .ilike("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function GET(req: Request) {
  try {
    const actor = await getMobilePatient(req);
    if (!actor?.patient_id) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parameterKeyRaw = searchParams.get("parameter_key") || searchParams.get("parameterKey");
    const parsedKey = ParameterKeySchema.safeParse(parameterKeyRaw);
    if (!parsedKey.success) {
      return NextResponse.json(
        { error: "parameter_key must be bp, weight, or glucose" },
        { status: 400 },
      );
    }

    const limitRaw = Number(searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;

    const supa = getSupabase();
    const pid = escapeLikeExact(String(actor.patient_id || "").trim());

    let query = supa
      .from("vitals_snapshots")
      .select("*")
      .ilike("patient_id", pid)
      .eq("source", "patient")
      .order("measured_at", { ascending: false })
      .limit(limit);

    if (parsedKey.data === "bp") {
      query = query.or("systolic_bp.not.is.null,diastolic_bp.not.is.null");
    } else if (parsedKey.data === "weight") {
      query = query.not("weight_kg", "is", null);
    } else {
      query = query.not("blood_glucose_mgdl", "is", null);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ vitals: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getMobilePatient(req);
    if (!actor?.patient_id) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse({
      parameter_key: body?.parameter_key ?? body?.parameterKey,
      measured_at: body?.measured_at ?? body?.measuredAt,
      systolic_bp: body?.systolic_bp ?? body?.systolicBp,
      diastolic_bp: body?.diastolic_bp ?? body?.diastolicBp,
      weight_kg: body?.weight_kg ?? body?.weightKg,
      blood_glucose_mgdl: body?.blood_glucose_mgdl ?? body?.bloodGlucoseMgdl,
    });

    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const patientId = normalizePatientId(actor.patient_id);
    const supa = getSupabase();
    const encounterId = await fetchLatestEncounterId(supa, patientId);

    if (!encounterId) {
      return NextResponse.json({ error: "No encounter found" }, { status: 404 });
    }

    const measuredAt = parsed.data.measured_at ? new Date(parsed.data.measured_at) : new Date();
    if (Number.isNaN(measuredAt.getTime())) {
      return NextResponse.json({ error: "Invalid measured_at" }, { status: 400 });
    }

    const systolic = toNullableNumber(parsed.data.systolic_bp);
    const diastolic = toNullableNumber(parsed.data.diastolic_bp);
    const weight = toNullableNumber(parsed.data.weight_kg);
    const glucose = toNullableNumber(parsed.data.blood_glucose_mgdl);

    if (parsed.data.parameter_key === "bp") {
      if (systolic == null || diastolic == null) {
        return NextResponse.json(
          { error: "systolic_bp and diastolic_bp are required" },
          { status: 400 },
        );
      }
    } else if (parsed.data.parameter_key === "weight") {
      if (weight == null) {
        return NextResponse.json({ error: "weight_kg is required" }, { status: 400 });
      }
    } else if (glucose == null) {
      return NextResponse.json({ error: "blood_glucose_mgdl is required" }, { status: 400 });
    }

    const createdBy = await resolvePatientUserId(supa, patientId).catch(() => null);

    const payload = {
      patient_id: patientId,
      encounter_id: encounterId,
      consultation_id: null,
      measured_at: measuredAt.toISOString(),
      source: "patient",
      created_by: createdBy,
      created_by_initials: "PT",
      systolic_bp: parsed.data.parameter_key === "bp" ? systolic : null,
      diastolic_bp: parsed.data.parameter_key === "bp" ? diastolic : null,
      weight_kg: parsed.data.parameter_key === "weight" ? weight : null,
      blood_glucose_mgdl: parsed.data.parameter_key === "glucose" ? glucose : null,
    };

    const { data, error } = await supa
      .from("vitals_snapshots")
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ vital: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

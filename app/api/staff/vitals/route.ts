import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { requireActor } from "@/lib/api-actor";
import { getSupabaseServer } from "@/lib/supabaseServer";

type SnapshotBody = {
  patient_id: string;
  consultation_id?: string | null;
  encounter_id: string;
  measured_at?: string;
  systolic_bp?: number | string | null;
  diastolic_bp?: number | string | null;
  hr?: number | string | null;
  rr?: number | string | null;
  temp_c?: number | string | null;
  height_cm?: number | string | null;
  weight_kg?: number | string | null;
  bmi?: number | string | null;
  o2sat?: number | string | null;
  notes?: string | null;
};

function toNullableNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const actor = await requireActor();
  if (!actor || (actor.kind !== "staff" && actor.kind !== "doctor")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const patient_id = searchParams.get("patient_id")?.trim();
  if (!patient_id) {
    return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
  }

  const supa = getSupabaseServer();
  let query = supa
    .from("vitals_snapshots")
    .select("*")
    .eq("patient_id", patient_id)
    .order("measured_at", { ascending: false });

  const limit = Number(searchParams.get("limit") ?? "0");
  if (Number.isFinite(limit) && limit > 0) query = query.limit(limit);

  const consultationId = searchParams.get("consultation_id");
  if (consultationId) query = query.eq("consultation_id", consultationId);

  const encounterId = searchParams.get("encounter_id");
  if (encounterId) query = query.eq("encounter_id", encounterId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ snapshots: data ?? [] });
}

export async function POST(req: Request) {
  const [actor, cookieStore] = await Promise.all([requireActor(), cookies()]);
  if (!actor || actor.kind !== "staff") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<SnapshotBody>;
  const patient_id = String(body.patient_id || "").trim();
  const consultation_id_raw = body.consultation_id;
  const consultation_id = consultation_id_raw ? String(consultation_id_raw).trim() : null;
  const encounter_id = String(body.encounter_id || "").trim();

  if (!patient_id || !encounter_id) {
    return NextResponse.json(
      { error: "patient_id and encounter_id are required" },
      { status: 400 }
    );
  }

  const supa = getSupabaseServer();

  let resolvedConsultationId = consultation_id;
  if (!resolvedConsultationId) {
    const { data: consultRow } = await supa
      .from("consultations")
      .select("id")
      .eq("encounter_id", encounter_id)
      .order("visit_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (consultRow?.id) resolvedConsultationId = consultRow.id;
  }

  const measured = body.measured_at ? new Date(body.measured_at) : new Date();
  if (Number.isNaN(measured.getTime())) {
    return NextResponse.json({ error: "Invalid measured_at" }, { status: 400 });
  }

  const readings = {
    systolic_bp: toNullableNumber(body.systolic_bp),
    diastolic_bp: toNullableNumber(body.diastolic_bp),
    hr: toNullableNumber(body.hr),
    rr: toNullableNumber(body.rr),
    temp_c: toNullableNumber(body.temp_c),
    height_cm: toNullableNumber(body.height_cm),
    weight_kg: toNullableNumber(body.weight_kg),
    bmi: toNullableNumber(body.bmi),
    o2sat: toNullableNumber(body.o2sat),
  };

  const initials =
    cookieStore.get("staff_initials")?.value ||
    cookieStore.get("staff_id")?.value ||
    cookieStore.get("staff_role")?.value ||
    actor.id;

  const payload = {
    patient_id,
    consultation_id: resolvedConsultationId,
    encounter_id,
    measured_at: measured.toISOString(),
    notes: body.notes ?? null,
    source: "staff",
    created_by_initials: initials,
    created_by: null,
    ...readings,
  };

  const { data, error } = await supa
    .from("vitals_snapshots")
    .insert(payload as any)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ snapshot: data });
}

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
  if (!actor || (actor.kind !== "staff" && actor.kind !== "doctor")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<SnapshotBody>;
  const patient_id = String(body.patient_id || "").trim().toUpperCase();
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

  const measured = body.measured_at ? new Date(body.measured_at) : new Date();
  if (Number.isNaN(measured.getTime())) {
    return NextResponse.json({ error: "Invalid measured_at" }, { status: 400 });
  }

  const tz = process.env.APP_TZ || "Asia/Manila";
  const fmtYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const measuredYmd = fmtYmd.format(measured);
  const dayStart = `${measuredYmd}T00:00:00+08:00`;
  const dayEnd = `${measuredYmd}T23:59:59.999+08:00`;

  const encounterRow = await supa
    .from("encounters")
    .select("id, branch_code")
    .eq("id", encounter_id)
    .maybeSingle();

  if (encounterRow.error || !encounterRow.data?.id) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 400 });
  }

  const encounterBranch = encounterRow.data.branch_code || null;

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

  if (!resolvedConsultationId) {
    const linkExisting = await supa
      .from("consultations")
      .select("id, encounter_id")
      .eq("patient_id", patient_id)
      .gte("visit_at", dayStart)
      .lte("visit_at", dayEnd)
      .order("visit_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!linkExisting.error && linkExisting.data?.id) {
      resolvedConsultationId = linkExisting.data.id;
      if (linkExisting.data.encounter_id !== encounter_id) {
        await supa
          .from("consultations")
          .update({ encounter_id })
          .eq("id", linkExisting.data.id);
      }
    }
  }

  if (!resolvedConsultationId) {
    const year = measuredYmd.slice(0, 4);
    const yearStart = `${year}-01-01T00:00:00+08:00`;
    const yearEnd = `${year}-12-31T23:59:59.999+08:00`;
    const { data: fpeExisting } = await supa
      .from("consultations")
      .select("id")
      .eq("patient_id", patient_id)
      .eq("type", "FPE")
      .gte("visit_at", yearStart)
      .lte("visit_at", yearEnd)
      .limit(1);
    const computedType =
      fpeExisting && fpeExisting.length > 0 ? "FollowUp" : "FPE";

    const inserted = await supa
      .from("consultations")
      .insert({
        patient_id,
        encounter_id,
        branch: encounterBranch,
        visit_at: measured.toISOString(),
        type: computedType,
        status: "draft",
        doctor_id: null,
        doctor_name_at_time: null,
        plan_shared: null,
      })
      .select("id")
      .maybeSingle();

    if (inserted.error || !inserted.data?.id) {
      return NextResponse.json(
        { error: inserted.error?.message || "Failed to create consultation" },
        { status: 400 }
      );
    }
    resolvedConsultationId = inserted.data.id;
  }

  if (!resolvedConsultationId) {
    return NextResponse.json(
      { error: "Could not resolve consultation_id" },
      { status: 400 }
    );
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
    cookieStore.get("doctor_initials")?.value ||
    cookieStore.get("doctor_code")?.value ||
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireActor } from "@/lib/api-actor";
import { getSupabase } from "@/lib/supabase";
import { phTodayYMD } from "@/lib/time";

function up(v?: string | null) {
  return (v || "").trim().toUpperCase();
}

export async function GET(req: Request) {
  const actor = await requireActor();
  if (!actor || actor.kind !== "doctor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const patientId = up(url.searchParams.get("patient_id"));
  if (!patientId) {
    return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
  }

  const today = phTodayYMD();
  const db = getSupabase();
  const { data, error } = await db
    .from("encounters")
    .select(
      "id, patient_id, branch_code, visit_date_local, status, consult_status, queue_number, for_consult, notes_frontdesk"
    )
    .eq("patient_id", patientId)
    .eq("branch_code", actor.branch)
    .eq("visit_date_local", today)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    today,
    encounters: data || [],
  });
}

export async function POST(req: Request) {
  const actor = await requireActor();
  if (!actor || actor.kind !== "doctor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const patientId = up(body?.patient_id || body?.patientId);
  const consultationId = String(body?.consultation_id || body?.consultationId || "").trim();
  const requestedEncounterId = String(body?.encounter_id || body?.encounterId || "").trim();
  const createNew = !!body?.create_new || !requestedEncounterId;

  if (!patientId || !consultationId) {
    return NextResponse.json(
      { error: "patient_id and consultation_id are required" },
      { status: 400 }
    );
  }

  const db = getSupabase();
  const today = phTodayYMD();
  const nowIso = new Date().toISOString();

  // Verify consultation ownership
  const { data: consult, error: consultErr } = await db
    .from("consultations")
    .select("id, patient_id, encounter_id")
    .eq("id", consultationId)
    .maybeSingle();

  if (consultErr) {
    return NextResponse.json({ error: consultErr.message }, { status: 400 });
  }
  if (!consult || up(consult.patient_id) !== patientId) {
    return NextResponse.json({ error: "Consultation not found for this patient" }, { status: 404 });
  }

  let encounterId = requestedEncounterId || null;
  let created = false;
  let existingStatus: string | null = null;

  if (createNew) {
    const { data: ins, error: insErr } = await db
      .from("encounters")
      .insert({
        patient_id: patientId,
        branch_code: actor.branch,
        visit_date_local: today,
        status: "intake",
        consult_status: "in_consult",
        for_consult: true,
        current_consultation_id: consultationId,
      })
      .select("id")
      .maybeSingle();

    if (insErr || !ins?.id) {
      return NextResponse.json(
        { error: insErr?.message || "Failed to create encounter" },
        { status: 400 }
      );
    }
    encounterId = ins.id;
    created = true;
  } else {
    const { data: enc, error: encErr } = await db
      .from("encounters")
      .select("id, patient_id, branch_code, visit_date_local, consult_status")
      .eq("id", encounterId)
      .maybeSingle();

    if (encErr) {
      return NextResponse.json({ error: encErr.message }, { status: 400 });
    }
    if (!enc || up(enc.patient_id) !== patientId) {
      return NextResponse.json({ error: "Encounter not found for this patient" }, { status: 404 });
    }
    if (up(enc.branch_code) !== up(actor.branch)) {
      return NextResponse.json({ error: "Encounter is for a different branch" }, { status: 400 });
    }
    if (enc.visit_date_local !== today) {
      return NextResponse.json(
        { error: "Only today's encounters (Asia/Manila) can be linked" },
        { status: 400 }
      );
    }
    existingStatus = enc.consult_status || null;
  }

  if (!encounterId) {
    return NextResponse.json({ error: "No encounter to link" }, { status: 400 });
  }

  // Link consultation -> encounter
  const { error: linkErr } = await db
    .from("consultations")
    .update({ encounter_id: encounterId, updated_at: nowIso })
    .eq("id", consultationId);

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 400 });
  }

  // Keep encounter in sync with active consultation
  const encounterPatch: Record<string, any> = {
    current_consultation_id: consultationId,
    updated_at: nowIso,
    for_consult: true,
  };
  if (!existingStatus || ["queued_for_consult", "in_consult", "in-progress"].includes(existingStatus)) {
    encounterPatch.consult_status = "in_consult";
  }

  const { error: encUpdateErr } = await db
    .from("encounters")
    .update(encounterPatch)
    .eq("id", encounterId);

  if (encUpdateErr) {
    return NextResponse.json({ error: encUpdateErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, encounter_id: encounterId, created });
}

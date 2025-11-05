export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getDoctorSession } from "@/lib/doctorSession";

const Payload = z.object({
  external_result_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  impression: z.string().min(1),
  rhythm: z.string().optional().nullable(),
  heart_rate: z.string().optional().nullable(),
  pr_interval: z.string().optional().nullable(),
  qrs_duration: z.string().optional().nullable(),
  qtc: z.string().optional().nullable(),
  axis: z.string().optional().nullable(),
  findings: z.string().optional().nullable(),
  recommendations: z.string().optional().nullable(),
});

type DoctorRow = {
  doctor_id?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  credentials?: string | null;
  prc_no?: string | null;
};

function sanitise(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const doctorSession = await getDoctorSession().catch(() => null);
    if (!doctorSession?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = Payload.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const sb = supabaseAdmin();

    // Load the external result to validate ownership/type
    const { data: extRow, error: extErr } = await sb
      .from("external_results")
      .select("id, type, category, subtype, patient_id, encounter_id")
      .eq("id", input.external_result_id)
      .maybeSingle();

    if (extErr) throw extErr;
    if (!extRow) {
      return NextResponse.json({ error: "External result not found" }, { status: 404 });
    }
    const typeLabel = String(extRow.type || "").trim().toUpperCase();
    const categoryLabel = String(extRow.category || "").trim().toUpperCase();
    const subtypeLabel = String(extRow.subtype || "").trim().toUpperCase();
    const isEcg =
      typeLabel.startsWith("ECG") ||
      categoryLabel === "ECG" ||
      subtypeLabel.startsWith("ECG");

    if (!isEcg) {
      return NextResponse.json({ error: "Result is not tagged as ECG" }, { status: 400 });
    }

    const patientId = String(extRow.patient_id).trim().toUpperCase();

    // Enforce encounter belongs to patient
    const { data: encRow, error: encErr } = await sb
      .from("encounters")
      .select("id, patient_id")
      .eq("id", input.encounter_id)
      .maybeSingle();

    if (encErr) throw encErr;
    if (!encRow || String(encRow.patient_id || "").trim().toUpperCase() !== patientId) {
      return NextResponse.json({ error: "Encounter does not belong to this patient" }, { status: 400 });
    }

    // Ensure no previous report exists (unique constraint guard)
    const { data: existing, error: existingErr } = await sb
      .from("ecg_reports")
      .select("id, status")
      .eq("external_result_id", input.external_result_id)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (existing?.id) {
      return NextResponse.json({ error: "ECG strip already has a finalized interpretation" }, { status: 409 });
    }

    // Fetch doctor profile to snapshot
    const doctorId = doctorSession.doctorId;
    const { data: docRow } = await sb
      .from("doctors")
      .select("doctor_id, display_name, full_name, credentials, prc_no")
      .eq("doctor_id", doctorId)
      .maybeSingle<DoctorRow>();

    const baseName =
      sanitise(docRow?.display_name) ||
      sanitise(docRow?.full_name) ||
      sanitise(doctorSession.display_name) ||
      sanitise(doctorSession.name) ||
      "Physician";

    const interpretedName = (() => {
      const name = baseName || "Physician";
      const credentials = sanitise(docRow?.credentials);
      return credentials ? `${name}, ${credentials}` : name;
    })();

    const interpretedLicense = sanitise(docRow?.prc_no);

    const insertPayload = {
      external_result_id: input.external_result_id,
      patient_id: patientId,
      encounter_id: input.encounter_id,
      doctor_id: doctorSession.doctorId,
      interpreted_name: interpretedName,
      interpreted_license: interpretedLicense,
      rhythm: sanitise(input.rhythm),
      heart_rate: sanitise(input.heart_rate),
      pr_interval: sanitise(input.pr_interval),
      qrs_duration: sanitise(input.qrs_duration),
      qtc: sanitise(input.qtc),
      axis: sanitise(input.axis),
      findings: sanitise(input.findings),
      impression: input.impression.trim(),
      recommendations: sanitise(input.recommendations),
      status: "final" as const,
    };

    const { data: inserted, error: insErr } = await sb
      .from("ecg_reports")
      .insert(insertPayload)
      .select(
        "id, encounter_id, doctor_id, interpreted_at, interpreted_name, interpreted_license, status, rhythm, heart_rate, pr_interval, qrs_duration, qtc, axis, findings, impression, recommendations"
      )
      .maybeSingle();

    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "ECG strip already has a finalized interpretation" }, { status: 409 });
      }
      throw insErr;
    }

    // Backfill encounter_id on external_results if missing
    if (!extRow.encounter_id) {
      await sb
        .from("external_results")
        .update({ encounter_id: input.encounter_id })
        .eq("id", input.external_result_id);
    }

    return NextResponse.json({ ok: true, report: inserted });
  } catch (e: any) {
    const message = e?.message || "Server error";
    const status =
      typeof e?.code === "string" && e.code === "23505"
        ? 409
        : message.toLowerCase().includes("duplicate")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

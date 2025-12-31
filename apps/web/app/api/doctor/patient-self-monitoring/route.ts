export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";

const ParameterKeySchema = z.enum(["bp", "weight", "glucose"]);

const ItemSchema = z.object({
  parameter_key: ParameterKeySchema,
  enabled: z.boolean(),
  instructions: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
});

const PayloadSchema = z.object({
  patient_id: z.string().min(1),
  consultation_id: z.string().min(1),
  encounter_id: z.string().uuid().optional().nullable(),
  items: z.array(ItemSchema).min(1),
});

const QuerySchema = z.object({
  patient_id: z.string().min(1),
});

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

function normalizePatientId(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function cleanText(value: unknown) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
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
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const supa = getSupabase();
    const pid = escapeLikeExact(normalizePatientId(parsed.data.patient_id));

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

export async function POST(req: Request) {
  try {
    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = PayloadSchema.safeParse({
      patient_id: raw?.patient_id ?? raw?.patientId,
      consultation_id: raw?.consultation_id ?? raw?.consultationId,
      encounter_id: raw?.encounter_id ?? raw?.encounterId ?? null,
      items: Array.isArray(raw?.items)
        ? raw.items.map((it: any) => ({
            parameter_key: it?.parameter_key ?? it?.parameterKey,
            enabled: Boolean(it?.enabled),
            instructions: it?.instructions ?? null,
            frequency: it?.frequency ?? null,
          }))
        : raw?.items,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supa = getSupabase();
    const patientId = normalizePatientId(parsed.data.patient_id);
    const consultationId = String(parsed.data.consultation_id).trim();
    let encounterId = parsed.data.encounter_id ? String(parsed.data.encounter_id).trim() : null;

    if (!consultationId) {
      return NextResponse.json({ error: "consultation_id is required" }, { status: 400 });
    }

    if (!encounterId) {
      const { data: consult, error: consultErr } = await supa
        .from("consultations")
        .select("id, patient_id, encounter_id")
        .eq("id", consultationId)
        .maybeSingle();
      if (consultErr) throw consultErr;
      if (!consult?.id) {
        return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
      }
      if (consult.patient_id && normalizePatientId(consult.patient_id) !== patientId) {
        return NextResponse.json(
          { error: "Consultation does not belong to this patient" },
          { status: 400 },
        );
      }
      encounterId = consult.encounter_id ? String(consult.encounter_id) : null;
    }

    const nowIso = new Date().toISOString();
    const payload = parsed.data.items.map((item) => ({
      patient_id: patientId,
      parameter_key: item.parameter_key,
      enabled: item.enabled,
      doctor_requested: item.enabled,
      instructions: cleanText(item.instructions),
      frequency: cleanText(item.frequency),
      consultation_id: consultationId,
      encounter_id: encounterId,
      doctor_id: doctor.doctorId,
      last_set_by: "doctor",
      last_set_by_user: doctor.doctorId,
      last_set_at: nowIso,
    }));

    const { data, error } = await supa
      .from("patient_self_monitoring")
      .upsert(payload, { onConflict: "patient_id,parameter_key" })
      .select("*");

    if (error) throw error;

    return NextResponse.json({ ok: true, monitoring: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

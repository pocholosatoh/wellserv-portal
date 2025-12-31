// app/api/staff/self-monitoring/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireActor } from "@/lib/api-actor";
import { getSupabase } from "@/lib/supabase";

type ParameterKey = "bp" | "weight" | "glucose";

type StaffSelfMonitoringRow = {
  patient_id: string;
  patient_code: string | null;
  patient_name?: string | null;
  prescribed: ParameterKey[];
  patient_initiated: boolean;
  prescribing_doctor_name: string | null;
  latest_patient_log_at: string | null;
};

type MonitoringRow = {
  patient_id: string | null;
  parameter_key: string | null;
  doctor_requested: boolean | null;
  last_set_at: string | null;
  doctor_id: string | null;
  last_set_by_user: string | null;
};

function ensureStaff(actor: Awaited<ReturnType<typeof requireActor>>) {
  return actor && actor.kind === "staff";
}

const PARAM_ORDER: ParameterKey[] = ["bp", "weight", "glucose"];
const PARAM_SET = new Set(PARAM_ORDER);

function toMillis(value?: string | null) {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeName(value?: string | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function GET() {
  const actor = await requireActor();
  if (!ensureStaff(actor)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supa = getSupabase();
    const { data: monitoringRows, error } = await supa
      .from("patient_self_monitoring")
      .select(
        "patient_id, parameter_key, enabled, doctor_requested, last_set_at, doctor_id, last_set_by_user",
      )
      .eq("enabled", true);

    if (error) throw error;

    const grouped = new Map<
      string,
      {
        prescribed: Set<ParameterKey>;
        latest: { last_set_at: string | null; doctor_id: string | null } | null;
        patientInitiated: boolean;
      }
    >();

    for (const row of (monitoringRows || []) as MonitoringRow[]) {
      const pid = String(row.patient_id || "").trim();
      if (!pid) continue;
      const parameter = String(row.parameter_key || "").trim() as ParameterKey;
      if (!PARAM_SET.has(parameter)) continue;

      let entry = grouped.get(pid);
      if (!entry) {
        entry = { prescribed: new Set<ParameterKey>(), latest: null, patientInitiated: false };
        grouped.set(pid, entry);
      }

      entry.prescribed.add(parameter);
      if (row.doctor_requested == null) {
        entry.patientInitiated = true;
      }

      const doctorId = normalizeName(row.doctor_id || row.last_set_by_user);
      const lastSetAt = normalizeName(row.last_set_at);
      const candidate = { last_set_at: lastSetAt, doctor_id: doctorId };

      if (!entry.latest) {
        entry.latest = candidate;
      } else {
        const currentMs = toMillis(entry.latest.last_set_at);
        const candidateMs = toMillis(candidate.last_set_at);
        if (
          candidateMs > currentMs ||
          (candidateMs === currentMs && !entry.latest.doctor_id && candidate.doctor_id)
        ) {
          entry.latest = candidate;
        }
      }
    }

    if (grouped.size === 0) {
      return NextResponse.json({ rows: [] });
    }

    const patientIds = Array.from(grouped.keys());

    const patientMap = new Map<string, string | null>();
    const { data: patientRows, error: patientErr } = await supa
      .from("patients")
      .select("patient_id, full_name")
      .in("patient_id", patientIds);
    if (patientErr) throw patientErr;
    (patientRows || []).forEach((p: any) => {
      if (p?.patient_id) patientMap.set(p.patient_id, normalizeName(p.full_name));
    });

    const doctorIds = Array.from(
      new Set(
        Array.from(grouped.values())
          .map((entry) => entry.latest?.doctor_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    const doctorMap = new Map<string, string | null>();
    if (doctorIds.length) {
      const { data: doctorRows, error: doctorErr } = await supa
        .from("doctors")
        .select("doctor_id, display_name, full_name")
        .in("doctor_id", doctorIds);
      if (doctorErr) throw doctorErr;
      (doctorRows || []).forEach((d: any) => {
        if (!d?.doctor_id) return;
        const name = normalizeName(d.display_name) || normalizeName(d.full_name);
        doctorMap.set(d.doctor_id, name);
      });
    }

    const logMap = new Map<string, string>();
    if (patientIds.length) {
      const { data: logRows, error: logErr } = await supa
        .from("vitals_snapshots")
        .select("patient_id, measured_at, systolic_bp, diastolic_bp, weight_kg, blood_glucose_mgdl")
        .in("patient_id", patientIds)
        .eq("source", "patient")
        .or(
          "systolic_bp.not.is.null,diastolic_bp.not.is.null,weight_kg.not.is.null,blood_glucose_mgdl.not.is.null",
        );
      if (logErr) throw logErr;

      for (const row of logRows || []) {
        const pid = String(row.patient_id || "").trim();
        const measuredAt = normalizeName(row.measured_at);
        if (!pid || !measuredAt) continue;

        const hasMeasurements =
          row.systolic_bp != null ||
          row.diastolic_bp != null ||
          row.weight_kg != null ||
          row.blood_glucose_mgdl != null;
        if (!hasMeasurements) continue;

        const prev = logMap.get(pid);
        if (!prev || toMillis(measuredAt) > toMillis(prev)) {
          logMap.set(pid, measuredAt);
        }
      }
    }

    const rows: StaffSelfMonitoringRow[] = patientIds.map((pid) => {
      const entry = grouped.get(pid);
      const prescribed = entry?.prescribed
        ? PARAM_ORDER.filter((p) => entry.prescribed.has(p))
        : [];
      const doctorId = entry?.latest?.doctor_id || null;

      return {
        patient_id: pid,
        patient_code: pid,
        patient_name: patientMap.get(pid) ?? null,
        prescribed,
        patient_initiated: entry?.patientInitiated ?? false,
        prescribing_doctor_name: doctorId ? (doctorMap.get(doctorId) ?? null) : null,
        latest_patient_log_at: logMap.get(pid) ?? null,
      };
    });

    rows.sort((a, b) => {
      const aHas = !!a.latest_patient_log_at;
      const bHas = !!b.latest_patient_log_at;
      if (!aHas && !bHas) return a.patient_id.localeCompare(b.patient_id);
      if (!aHas) return -1;
      if (!bHas) return 1;

      const aMs = toMillis(a.latest_patient_log_at);
      const bMs = toMillis(b.latest_patient_log_at);
      if (aMs !== bMs) return aMs - bMs;
      return a.patient_id.localeCompare(b.patient_id);
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    console.error("[staff/self-monitoring] GET error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

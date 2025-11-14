// app/api/doctor/medical-certificates/supporting-data/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/doctorSession";
import { getSupabase } from "@/lib/supabase";
import { summarizeVitals } from "@/lib/medicalCertificateSchema";
import {
  buildLabRangeMap,
  deriveLabFlag,
  formatLabEntrySummary,
} from "@/lib/medicalCertificateLabs";

type EncounterRow = {
  id: string;
  patient_id: string;
  visit_date_local: string | null;
  notes_frontdesk: string | null;
};

type VitalsRow = {
  id: string;
  patient_id: string;
  measured_at: string | null;
};

type DiagnosisRow = {
  id: string;
  icd10_code: string | null;
  icd10_text_snapshot: string | null;
};

type NotesRow = {
  notes_markdown?: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: process.env.APP_TZ || "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const DATE_FMT_DAY = new Intl.DateTimeFormat("en-PH", {
  timeZone: process.env.APP_TZ || "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return null;
  return DATE_FMT.format(dt);
}

function formatDateDay(iso?: string | null) {
  if (!iso) return "recent";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return DATE_FMT_DAY.format(dt);
}

function normalizePatientId(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export async function GET(req: Request) {
  try {
    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const patientId = normalizePatientId(url.searchParams.get("patient_id"));
    const consultationId = url.searchParams.get("consultation_id")?.trim() || null;
    const encounterId = url.searchParams.get("encounter_id")?.trim() || null;

    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const db = getSupabase();

    const suggestions: Array<{
      type: string;
      label: string;
      summary: string;
      source_id?: string | null;
    }> = [];

    const encounter = encounterId
      ? await db
          .from("encounters")
          .select("id, patient_id, visit_date_local, notes_frontdesk")
          .eq("id", encounterId)
          .maybeSingle()
      : { data: null, error: null };

    if (encounter.error) {
      return NextResponse.json({ error: encounter.error.message }, { status: 400 });
    }
    const encounterRow = encounter.data as EncounterRow | null;
    if (encounterRow && encounterRow.patient_id !== patientId) {
      return NextResponse.json({ error: "Encounter does not belong to patient" }, { status: 400 });
    }

    let labSuggestionAdded = false;

    const vitals = await db
      .from("vitals_snapshots")
      .select(
        [
          "id",
          "patient_id",
          "measured_at",
          "systolic_bp",
          "diastolic_bp",
          "hr",
          "rr",
          "temp_c",
          "o2sat",
          "weight_kg",
          "height_cm",
          "bmi",
        ].join(", ")
      )
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vitals.error) {
      return NextResponse.json({ error: vitals.error.message }, { status: 400 });
    }
    const vitalsRow = vitals.data as VitalsRow | null;
    if (vitalsRow) {
      const summary = summarizeVitals(vitalsRow);
      if (summary) {
        suggestions.push({
          type: "vitals",
          source_id: vitalsRow.id,
          label: `Vitals (${formatDate(vitalsRow.measured_at) || "latest"})`,
          summary,
        });
      }
    }

    const labs = await db
      .from("results_flat")
      .select("*")
      .eq("patient_id", patientId)
      .order("date_of_test", { ascending: false })
      .limit(200);

    if (labs.error) {
      return NextResponse.json({ error: labs.error.message }, { status: 400 });
    }

    const rangeMap = await buildLabRangeMap(db);

    const labRows = (labs.data || []).map((row) => ({
      ...row,
      resolved_flag: deriveLabFlag(row, rangeMap),
    }));

    type LabBucket = { iso: string; entries: string[] };

    const normalizeDay = (raw: any) => {
      if (!raw) return "recent";
      const dt = new Date(raw);
      if (Number.isNaN(+dt)) return raw;
      return dt.toISOString().slice(0, 10);
    };

    const orderedDays = (rows: any[]): string[] => {
      const seen: string[] = [];
      for (const lab of rows) {
        const day = normalizeDay(lab.date_of_test || lab.test_date);
        if (!seen.includes(day)) {
          seen.push(day);
          if (seen.length >= 3) break;
        }
      }
      return seen;
    };

    const buildBuckets = (rows: any[], allowedDays: string[]): LabBucket[] => {
      const allowed = new Set(allowedDays);
      const buckets = new Map<string, LabBucket>();
      for (const lab of rows) {
        const day = normalizeDay(lab.date_of_test || lab.test_date);
        if (!allowed.has(day)) continue;
        const entry = formatLabEntrySummary(lab, lab.resolved_flag, rangeMap);
        if (!entry) continue;
        const bucket: LabBucket = buckets.get(day) ?? { iso: day, entries: [] as string[] };
        bucket.entries.push(entry);
        buckets.set(day, bucket);
      }
      return allowedDays
        .map((day) => buckets.get(day))
        .filter((bucket): bucket is LabBucket => !!bucket);
    };

    const flaggedLabs = labRows.filter((lab: any) => {
      return lab.resolved_flag === "H" || lab.resolved_flag === "L" || lab.resolved_flag === "A";
    });

    const allDays = orderedDays(labRows);
    const flaggedDays = orderedDays(flaggedLabs);
    const desiredDays: string[] = [...flaggedDays];
    for (const day of allDays) {
      if (!desiredDays.includes(day)) desiredDays.push(day);
      if (desiredDays.length >= 3) break;
    }

    const flaggedBuckets = buildBuckets(flaggedLabs, desiredDays);
    for (const bucket of flaggedBuckets) {
      const label = `Lab tests done (${formatDateDay(bucket.iso)})`;
      const summary = bucket.entries.slice(0, 4).join("; ");
      suggestions.push({
        type: "labs",
        source_id: bucket.iso,
        label,
        summary: summary || "See report",
      });
      labSuggestionAdded = true;
    }

    if (!labSuggestionAdded && labRows.length) {
      const fallbackBuckets = buildBuckets(labRows, desiredDays);
      for (const bucket of fallbackBuckets) {
        const label = `Lab tests done (${formatDateDay(bucket.iso)})`;
        const summary = bucket.entries.slice(0, 4).join("; ");
        suggestions.push({
          type: "labs",
          source_id: bucket.iso,
          label,
          summary: summary || "See report",
        });
        labSuggestionAdded = true;
      }
    }

    if (!labSuggestionAdded && encounterRow) {
      const reason = encounterRow.notes_frontdesk || "";
      const label = `Lab tests done (${encounterRow.visit_date_local || "today"})`;
      if (reason) {
        suggestions.push({
          type: "labs",
          source_id: encounterRow.id,
          label,
          summary: reason,
        });
      }
    }

    if (consultationId) {
      const diagnoses = await db
        .from("consultation_diagnoses")
        .select("id, icd10_code, icd10_text_snapshot, is_primary")
        .eq("consultation_id", consultationId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (diagnoses.error) {
        return NextResponse.json({ error: diagnoses.error.message }, { status: 400 });
      }
      const diagnosisRows = (diagnoses.data || []) as DiagnosisRow[];
      const summary = diagnosisRows
        .map((d) =>
          d.icd10_code
            ? `${d.icd10_code} — ${d.icd10_text_snapshot || ""}`.trim()
            : d.icd10_text_snapshot || ""
        )
        .filter(Boolean)
        .join("; ");
      if (summary) {
        suggestions.push({
          type: "diagnosis",
          label: "Consultation diagnoses",
          summary,
        });
      }

      const notes = await db
        .from("doctor_notes")
        .select("notes_markdown")
        .eq("consultation_id", consultationId)
        .maybeSingle();
      if (notes.error) {
        return NextResponse.json({ error: notes.error.message }, { status: 400 });
      }
      const notesRow = notes.data as NotesRow | null;
      const plain = notesRow?.notes_markdown
        ? String(notesRow.notes_markdown)
            .replace(/[#*_`>-]/g, "")
            .replace(/\s+/g, " ")
            .trim()
        : "";
      if (plain) {
        suggestions.push({
          type: "notes",
          label: "Doctor notes summary",
          summary: plain.slice(0, 280),
        });
      }
    }

    return NextResponse.json({ suggestions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

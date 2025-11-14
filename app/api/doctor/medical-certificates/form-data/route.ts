// app/api/doctor/medical-certificates/form-data/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";
import {
  createDefaultPhysicalExam,
  PHYSICAL_EXAM_SECTIONS,
  summarizeVitals,
} from "@/lib/medicalCertificateSchema";
import { signDoctorSignature } from "@/lib/medicalCertificates";

type ConsultationRow = {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  visit_at: string | null;
  type: string | null;
  status: string | null;
  branch: string | null;
  doctor_id: string | null;
  doctor_name_at_time: string | null;
};

type EncounterRow = {
  id: string;
  patient_id: string;
  branch_code: string | null;
  visit_date_local: string | null;
  notes_frontdesk: string | null;
  consult_status: string | null;
};

type DiagnosisRow = {
  id: string;
  consultation_id: string;
  icd10_code: string | null;
  icd10_text_snapshot: string | null;
  is_primary: boolean | null;
};

const DATE_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: process.env.APP_TZ || "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function normalizePatientId(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function isUuid(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return null;
  return DATE_FMT.format(dt);
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

    const patient = await db
      .from("patients")
      .select(
        [
          "patient_id",
          "full_name",
          "sex",
          "birthday",
          "age",
          "address",
          "contact",
        ].join(", ")
      )
      .eq("patient_id", patientId)
      .maybeSingle();

    if (patient.error) {
      return NextResponse.json({ error: patient.error.message }, { status: 400 });
    }
    if (!patient.data) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    let consultation: any = null;
    if (consultationId) {
      const cons = await db
        .from("consultations")
        .select(
          [
            "id",
            "patient_id",
            "encounter_id",
            "visit_at",
            "type",
            "status",
            "branch",
            "doctor_id",
            "doctor_name_at_time",
          ].join(", ")
        )
        .eq("id", consultationId)
        .maybeSingle();

      if (cons.error) {
        return NextResponse.json({ error: cons.error.message }, { status: 400 });
      }
      const consultationRow = cons.data as ConsultationRow | null;
      if (consultationRow) {
        if (consultationRow.patient_id !== patientId) {
          return NextResponse.json({ error: "Consultation does not belong to patient" }, { status: 400 });
        }
        consultation = consultationRow;
      }
    }

    let encounter: any = null;
    const targetEncounterId = encounterId || consultation?.encounter_id || null;
    if (targetEncounterId) {
      const enc = await db
        .from("encounters")
        .select(
          [
            "id",
            "patient_id",
            "branch_code",
            "visit_date_local",
            "notes_frontdesk",
            "consult_status",
          ].join(", ")
        )
        .eq("id", targetEncounterId)
        .maybeSingle();
      if (enc.error) {
        return NextResponse.json({ error: enc.error.message }, { status: 400 });
      }
      const encounterRow = enc.data as EncounterRow | null;
      if (encounterRow && encounterRow.patient_id !== patientId) {
        return NextResponse.json({ error: "Encounter does not belong to patient" }, { status: 400 });
      }
      encounter = encounterRow;
    }

    const vitals = await db
      .from("vitals_snapshots")
      .select(
        [
          "id",
          "patient_id",
          "encounter_id",
          "consultation_id",
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

    const diagnoses =
      consultation
        ? await db
            .from("consultation_diagnoses")
            .select(
              [
                "id",
                "consultation_id",
                "icd10_code",
                "icd10_text_snapshot",
                "is_primary",
              ].join(", ")
            )
            .eq("consultation_id", consultation.id)
            .order("is_primary", { ascending: false })
            .order("created_at", { ascending: true })
        : { data: [], error: null };

    if (diagnoses.error) {
      return NextResponse.json({ error: diagnoses.error.message }, { status: 400 });
    }
    const diagnosisRows = (diagnoses.data || []) as DiagnosisRow[];

    const notes = consultation
      ? await db
          .from("doctor_notes")
          .select("notes_markdown, notes_soap")
          .eq("consultation_id", consultation.id)
          .maybeSingle()
      : { data: null, error: null };
    if (notes.error) {
      return NextResponse.json({ error: notes.error.message }, { status: 400 });
    }

    const fallbackDisplay = (doctor.display_name || doctor.name || "").trim();
    const fallbackFull = (doctor.name || doctor.display_name || fallbackDisplay || "").trim();

    let doctorProfile: any = null;
    if (isUuid(doctor.doctorId)) {
      const prof = await db
        .from("doctors")
        .select(
          [
            "doctor_id",
            "display_name",
            "full_name",
            "credentials",
            "specialty",
            "affiliations",
            "prc_no",
            "ptr_no",
            "s2_no",
            "signature_image_url",
          ].join(", ")
        )
        .eq("doctor_id", doctor.doctorId)
        .maybeSingle();
      if (prof.error) {
        return NextResponse.json({ error: prof.error.message }, { status: 400 });
      }
      doctorProfile = prof.data;
      if (doctorProfile) {
        doctorProfile.display_name = doctorProfile.display_name || fallbackDisplay || null;
        doctorProfile.full_name = doctorProfile.full_name || fallbackFull || null;
        doctorProfile.credentials = doctorProfile.credentials || doctor.credentials || null;
      }
      if (doctorProfile?.signature_image_url) {
        doctorProfile.signed_signature_url = await signDoctorSignature(
          db,
          doctorProfile.signature_image_url
        );
      }
    } else {
      doctorProfile = {
        doctor_id: null,
        display_name: fallbackDisplay || (fallbackFull || "Reliever Doctor"),
        full_name: fallbackFull || fallbackDisplay || "Reliever Doctor",
        credentials: doctor.credentials || null,
        specialty: null,
        affiliations: null,
        prc_no: null,
        ptr_no: null,
        s2_no: null,
        signature_image_url: null,
        signed_signature_url: null,
      };
    }

    const basePhysicalExam = createDefaultPhysicalExam();

    return NextResponse.json({
      patient: patient.data,
      encounter,
      consultation,
      doctor: doctorProfile
        ? {
            ...doctorProfile,
            signed_signature_url: doctorProfile.signed_signature_url ?? null,
          }
        : null,
      vitals: vitals.data ?? null,
      vitals_summary: summarizeVitals(vitals.data ?? null),
      diagnoses: diagnoses.data ?? [],
      notes: notes.data ?? null,
      physical_exam: basePhysicalExam,
      physical_exam_sections: PHYSICAL_EXAM_SECTIONS,
      defaults: {
        diagnosis_text: diagnosisRows
          .map((d) =>
            d.icd10_code
              ? `${d.icd10_code} — ${d.icd10_text_snapshot || ""}`.trim()
              : d.icd10_text_snapshot || ""
          )
          .filter(Boolean)
          .join("; "),
        remarks: "",
        advice: "",
      },
      encounter_reference: encounter
        ? {
            id: encounter.id,
            branch: encounter.branch_code,
            visit_date: encounter.visit_date_local,
            reason: encounter.notes_frontdesk || null,
          }
        : null,
      consultation_reference: consultation
        ? {
            id: consultation.id,
            visit_at: consultation.visit_at,
            branch: consultation.branch,
            type: consultation.type,
            doctor_name: consultation.doctor_name_at_time,
          }
        : null,
      meta: {
        generated_at: formatDate(new Date().toISOString()),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

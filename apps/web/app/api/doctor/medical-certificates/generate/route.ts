// app/api/doctor/medical-certificates/generate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";
import {
  createDefaultPhysicalExam,
  summarizeVitals,
} from "@/lib/medicalCertificateSchema";
import {
  generateCertificateNo,
  generateQrToken,
  generateVerificationCode,
} from "@/lib/medicalCertificates";

function normalizePatientId(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

type SupportingEntry = {
  type?: string;
  label?: string;
  summary?: string;
  source_id?: string | null;
  payload?: Record<string, any> | null;
};

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

type VitalsRow = {
  id?: string;
  measured_at?: string;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  hr?: number | null;
  rr?: number | null;
  temp_c?: number | null;
  o2sat?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  bmi?: number | null;
};

type DoctorProfileRow = {
  doctor_id: string;
  display_name: string | null;
  full_name: string | null;
  credentials: string | null;
  specialty: string | null;
  affiliations: string | null;
  prc_no: string | null;
  ptr_no: string | null;
  s2_no: string | null;
  signature_image_url: string | null;
};

export async function POST(req: Request) {
  try {
    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      diagnosis_text,
      remarks,
      advice,
      findings_summary,
      days_unfit,
      physical_exam,
      supporting_data: supportingDataInput,
    } = body ?? {};

    const patientId = normalizePatientId(body?.patient_id);
    const encounterId = (body?.encounter_id || "").toString().trim();
    const consultationId = (body?.consultation_id || "").toString().trim();

    if (!patientId || !encounterId || !consultationId) {
      return NextResponse.json(
        { error: "patient_id, encounter_id, and consultation_id are required" },
        { status: 400 }
      );
    }

    const db = getSupabase();

    const patientRes = await db
      .from("patients")
      .select("patient_id, full_name, birthday, age, sex, address")
      .eq("patient_id", patientId)
      .maybeSingle();

    if (patientRes.error || !patientRes.data) {
      return NextResponse.json(
        { error: patientRes.error?.message || "Patient not found" },
        { status: 400 }
      );
    }

    const consultationRes = await db
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

    if (consultationRes.error || !consultationRes.data) {
      return NextResponse.json(
        { error: consultationRes.error?.message || "Consultation not found" },
        { status: 400 }
      );
    }
    const consultation = consultationRes.data as unknown as ConsultationRow;
    if (consultation.patient_id !== patientId) {
      return NextResponse.json(
        { error: "Consultation does not belong to patient" },
        { status: 400 }
      );
    }

    const encounterRes = await db
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
      .eq("id", encounterId)
      .maybeSingle();

    if (encounterRes.error || !encounterRes.data) {
      return NextResponse.json(
        { error: encounterRes.error?.message || "Encounter not found" },
        { status: 400 }
      );
    }
    const encounter = encounterRes.data as unknown as EncounterRow;
    if (encounter.patient_id !== patientId) {
      return NextResponse.json(
        { error: "Encounter does not belong to patient" },
        { status: 400 }
      );
    }

    const doctorProfileRes = await db
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

    if (doctorProfileRes.error || !doctorProfileRes.data) {
      return NextResponse.json(
        { error: doctorProfileRes.error?.message || "Doctor profile not found" },
        { status: 400 }
      );
    }

    const patient = patientRes.data;
    const doctorProfile = doctorProfileRes.data as unknown as DoctorProfileRow;

    const vitalsRes = await db
      .from("vitals_snapshots")
      .select(
        [
          "id",
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

    const vitals = (vitalsRes.data as unknown as VitalsRow | null) ?? null;
    const vitals_summary = summarizeVitals(vitals);

    const supporting_data: SupportingEntry[] = [];
    if (Array.isArray(supportingDataInput)) {
      for (const entry of supportingDataInput) {
        if (!entry || typeof entry !== "object") continue;
        const label = (entry.label || "").toString().trim();
        const summary = (entry.summary || "").toString().trim();
        if (!label || !summary) continue;
        supporting_data.push({
          type: (entry.type || "note").toString(),
          label,
          summary,
          source_id: entry.source_id ? String(entry.source_id) : null,
          payload: entry.payload && typeof entry.payload === "object" ? entry.payload : null,
        });
      }
    }

    if (vitals) {
      supporting_data.push({
        type: "vitals",
        label: "Most recent vitals",
        summary: vitals_summary || "Vitals snapshot",
        source_id: vitals.id ?? null,
        payload: vitals,
      });
    }

    const patient_snapshot = {
      patient_id: patient.patient_id,
      full_name: patient.full_name,
      birthday: patient.birthday,
      age: patient.age,
      sex: patient.sex,
      address: patient.address,
    };

    const consultation_snapshot = {
      id: consultation.id,
      visit_at: consultation.visit_at,
      branch: consultation.branch,
      type: consultation.type,
      status: consultation.status,
      doctor_id: consultation.doctor_id,
      doctor_name_at_time: consultation.doctor_name_at_time,
    };

    const doctor_snapshot = {
      doctor_id: doctorProfile.doctor_id,
      display_name: doctorProfile.display_name,
      full_name: doctorProfile.full_name,
      credentials: doctorProfile.credentials,
      specialty: doctorProfile.specialty,
      affiliations: doctorProfile.affiliations,
      prc_no: doctorProfile.prc_no,
      ptr_no: doctorProfile.ptr_no,
      s2_no: doctorProfile.s2_no,
      signature_image_url: doctorProfile.signature_image_url,
    };

    const issuedAt = new Date();
    const validUntil =
      typeof days_unfit === "number" && days_unfit > 0
        ? new Date(issuedAt.getTime() + days_unfit * 24 * 60 * 60 * 1000)
        : new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const basePhysicalExam = createDefaultPhysicalExam();
    if (physical_exam && typeof physical_exam === "object") {
      for (const [key, value] of Object.entries(physical_exam)) {
        if (!Object.prototype.hasOwnProperty.call(basePhysicalExam, key)) continue;
        if (!value || typeof value !== "object") continue;
        const status =
          (value as any).status === "abnormal" || (value as any).status === "normal"
            ? (value as any).status
            : "normal";
        const remarks = typeof (value as any).remarks === "string" ? (value as any).remarks : "";
        (basePhysicalExam as any)[key] = { status, remarks };
      }
    }

    const certificate_no = generateCertificateNo();
    const qr_token = generateQrToken();
    const verification_code = generateVerificationCode();

    const { data, error } = await db
      .from("medical_certificates")
      .insert([
        {
          certificate_no,
          patient_id: patient.patient_id,
          encounter_id: encounter.id,
          consultation_id: consultation.id,
          issued_at: issuedAt.toISOString(),
          valid_until: validUntil.toISOString(),
          status: "issued",
          patient_full_name: patient.full_name,
          patient_birthdate: patient.birthday,
          patient_age: patient.age,
          patient_sex: patient.sex,
          patient_address: patient.address,
          diagnosis_source: "consultation",
          diagnosis_text: diagnosis_text || null,
          remarks: remarks || null,
          advice: advice || null,
          findings_summary: findings_summary || null,
          physical_exam: basePhysicalExam,
          supporting_data,
          patient_snapshot,
          consultation_snapshot,
          doctor_snapshot,
          doctor_id: doctorProfile.doctor_id,
          doctor_branch: encounter.branch_code,
          qr_token,
          verification_code,
          created_by_doctor_id: doctorProfile.doctor_id,
        },
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        certificate: data,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("Error generating medical certificate", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

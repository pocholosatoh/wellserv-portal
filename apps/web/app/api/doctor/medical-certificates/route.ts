// app/api/doctor/medical-certificates/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";
import { guard } from "@/lib/auth/guard";
import {
  generateCertificateNo,
  generateQrToken,
  generateVerificationCode,
} from "@/lib/medicalCertificates";
import { normalizePhysicalExam, SupportingDataEntry } from "@/lib/medicalCertificateSchema";

type MedicalCertificateRow = {
  id: string;
  certificate_no: string | null;
  patient_id: string;
  consultation_id: string | null;
  encounter_id: string | null;
  issued_at: string | null;
  valid_until: string | null;
  status: string | null;
  doctor_id: string | null;
  doctor_snapshot: Record<string, any> | null;
};

type PatientRow = {
  patient_id: string;
  full_name: string | null;
  birthday: string | null;
  age: number | null;
  sex: string | null;
  address: string | null;
};

type ConsultationRow = {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  branch: string | null;
};

type EncounterRow = {
  id: string;
  patient_id: string;
};

type DiagnosisRow = {
  id: string;
  consultation_id: string;
  icd10_code: string | null;
  icd10_text_snapshot: string | null;
  is_primary: boolean | null;
};

type NotesRow = {
  notes_markdown?: string | null;
  notes_soap?: string | null;
};

type VitalsRow = {
  id: string;
  consultation_id: string | null;
  measured_at: string | null;
};

type DoctorRow = {
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

type DoctorSnapshot = {
  doctor_id: string | null;
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

function normalizePatientId(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function isUuid(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function calcAge(birthday?: string | null) {
  if (!birthday) return null;
  const dob = new Date(birthday);
  if (Number.isNaN(+dob)) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export async function GET(req: Request) {
  try {
    const auth = await guard(req, {
      allow: ["doctor"],
      requireBranch: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;

    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const patientId = normalizePatientId(auth.patientId);
    const consultationId = url.searchParams.get("consultation_id")?.trim() || null;
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 10) || 10));

    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const db = getSupabase();
    let query = db
      .from("medical_certificates")
      .select(
        [
          "id",
          "certificate_no",
          "patient_id",
          "consultation_id",
          "encounter_id",
          "issued_at",
          "valid_until",
          "status",
          "doctor_id",
          "doctor_snapshot",
        ].join(", "),
      )
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false })
      .limit(limit);

    if (consultationId) {
      query = query.eq("consultation_id", consultationId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data || []) as unknown as MedicalCertificateRow[];
    const items = rows.map((row) => ({
      id: row.id,
      certificate_no: row.certificate_no,
      consultation_id: row.consultation_id,
      encounter_id: row.encounter_id,
      issued_at: row.issued_at,
      valid_until: row.valid_until,
      status: row.status,
      doctor_snapshot: row.doctor_snapshot,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await guard(req, {
      allow: ["doctor"],
      requireBranch: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;

    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isFullDoctor = isUuid(doctor.doctorId);

    const body = await req.json().catch(() => ({}));
    const patientId = normalizePatientId(auth.patientId);
    const consultationId = (body.consultation_id || body.consultationId || "").trim();
    const encounterId = (body.encounter_id || body.encounterId || "").trim();

    if (!patientId || !consultationId || !encounterId) {
      return NextResponse.json(
        { error: "patient_id, consultation_id, and encounter_id are required." },
        { status: 400 },
      );
    }

    const physicalExam = normalizePhysicalExam(body.physical_exam);

    const supportingData: SupportingDataEntry[] = Array.isArray(body.supporting_data)
      ? (body.supporting_data
          .map((entry: any) => {
            if (!entry || typeof entry !== "object") return null;
            const label = (entry.label || "").toString().trim();
            const summary = (entry.summary || "").toString().trim();
            if (!label || !summary) return null;
            return {
              type: (entry.type || "note").toString(),
              label,
              summary,
              source_id: entry.source_id ? String(entry.source_id) : null,
              payload: entry.payload && typeof entry.payload === "object" ? entry.payload : null,
            } as SupportingDataEntry;
          })
          .filter(Boolean) as SupportingDataEntry[])
      : [];

    const db = getSupabase();

    // Ensure only one certificate per consultation/encounter.
    type IdRow = { id: string };
    let existingCert: IdRow | null = null;
    if (consultationId) {
      const existingByConsult = await db
        .from("medical_certificates")
        .select("id")
        .eq("consultation_id", consultationId)
        .maybeSingle();
      if (existingByConsult.error) {
        return NextResponse.json({ error: existingByConsult.error.message }, { status: 400 });
      }
      existingCert = (existingByConsult.data as IdRow | null) ?? null;
    }
    if (!existingCert && encounterId) {
      const existingByEncounter = await db
        .from("medical_certificates")
        .select("id")
        .eq("encounter_id", encounterId)
        .maybeSingle();
      if (existingByEncounter.error) {
        return NextResponse.json({ error: existingByEncounter.error.message }, { status: 400 });
      }
      existingCert = (existingByEncounter.data as IdRow | null) ?? null;
    }

    if (existingCert?.id) {
      return NextResponse.json(
        { error: "certificate_exists", certificate_id: existingCert.id },
        { status: 409 },
      );
    }

    const patient = await db.from("patients").select("*").eq("patient_id", patientId).maybeSingle();
    if (patient.error) return NextResponse.json({ error: patient.error.message }, { status: 400 });
    const patientRow = patient.data as PatientRow | null;
    if (!patientRow) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const consultation = await db
      .from("consultations")
      .select("*")
      .eq("id", consultationId)
      .maybeSingle();
    if (consultation.error) {
      return NextResponse.json({ error: consultation.error.message }, { status: 400 });
    }
    const consultationRow = consultation.data as ConsultationRow | null;
    if (!consultationRow) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }
    if (consultationRow.patient_id !== patientId) {
      return NextResponse.json(
        { error: "Consultation does not belong to patient" },
        { status: 400 },
      );
    }

    const encounter = await db.from("encounters").select("*").eq("id", encounterId).maybeSingle();
    if (encounter.error) {
      return NextResponse.json({ error: encounter.error.message }, { status: 400 });
    }
    const encounterRow = encounter.data as EncounterRow | null;
    if (!encounterRow) {
      return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
    }
    if (encounterRow.patient_id !== patientId) {
      return NextResponse.json({ error: "Encounter does not belong to patient" }, { status: 400 });
    }

    const diagnoses = await db
      .from("consultation_diagnoses")
      .select(
        [
          "id",
          "consultation_id",
          "icd10_code",
          "icd10_text_snapshot",
          "is_primary",
          "created_at",
        ].join(", "),
      )
      .eq("consultation_id", consultationId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (diagnoses.error) {
      return NextResponse.json({ error: diagnoses.error.message }, { status: 400 });
    }
    const diagnosisRows = (diagnoses.data || []) as unknown as DiagnosisRow[];

    const notes = await db
      .from("doctor_notes")
      .select("notes_markdown, notes_soap")
      .eq("consultation_id", consultationId)
      .maybeSingle();
    if (notes.error) {
      return NextResponse.json({ error: notes.error.message }, { status: 400 });
    }
    const notesRow = notes.data as NotesRow | null;

    const vitals = await db
      .from("vitals_snapshots")
      .select("*")
      .eq("consultation_id", consultationId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vitals.error) {
      return NextResponse.json({ error: vitals.error.message }, { status: 400 });
    }
    const vitalsRow = vitals.data as VitalsRow | null;

    let doctorRow: DoctorRow | null = null;
    if (isFullDoctor) {
      const doc = await db
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
          ].join(", "),
        )
        .eq("doctor_id", doctor.doctorId)
        .maybeSingle();
      if (doc.error) {
        return NextResponse.json({ error: doc.error.message }, { status: 400 });
      }
      doctorRow = (doc.data as DoctorRow | null) ?? null;
      if (!doctorRow) {
        return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
      }
    }

    const fallbackDisplay = (doctor.display_name || doctor.name || "").trim();
    const fallbackFull = (doctor.name || doctor.display_name || fallbackDisplay || "").trim();

    const doctorSnapshot: DoctorSnapshot = doctorRow
      ? {
          doctor_id: doctorRow.doctor_id || null,
          display_name: doctorRow.display_name || fallbackDisplay || null,
          full_name: doctorRow.full_name || fallbackFull || null,
          credentials: doctorRow.credentials || doctor.credentials || null,
          specialty: doctorRow.specialty || null,
          affiliations: doctorRow.affiliations || null,
          prc_no: doctorRow.prc_no || doctor.prc_no || null,
          ptr_no: doctorRow.ptr_no || null,
          s2_no: doctorRow.s2_no || null,
          signature_image_url: doctorRow.signature_image_url || null,
        }
      : {
          doctor_id: null,
          display_name: fallbackDisplay || fallbackFull || "Reliever Doctor",
          full_name: fallbackFull || fallbackDisplay || "Reliever Doctor",
          credentials: doctor.credentials || null,
          specialty: null,
          affiliations: null,
          prc_no: doctor.prc_no || null,
          ptr_no: null,
          s2_no: null,
          signature_image_url: null,
        };

    const certificateDoctorId = doctorRow?.doctor_id ?? null;

    const issuedAt = new Date();
    const validUntil = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const certificateNo = generateCertificateNo(issuedAt);
    const qrToken = generateQrToken();
    const verificationCode = generateVerificationCode();

    const diagnosisFromConsult = diagnosisRows
      .map((d) =>
        d.icd10_code
          ? `${d.icd10_code} — ${d.icd10_text_snapshot || ""}`.trim()
          : d.icd10_text_snapshot || "",
      )
      .filter(Boolean)
      .join("; ");

    const diagnosisText =
      String(body.diagnosis_text || body.diagnosisText || "").trim() || diagnosisFromConsult;
    const diagnosisSource = String(
      body.diagnosis_source ||
        body.diagnosisSource ||
        (body.diagnosis_text ? "manual" : "consultation"),
    ).toLowerCase();

    const certificatePayload = {
      certificate_no: certificateNo,
      patient_id: patientId,
      encounter_id: encounterId,
      consultation_id: consultationId,
      issued_at: issuedAt.toISOString(),
      valid_until: validUntil.toISOString(),
      status: "issued",
      patient_full_name: patientRow.full_name || "",
      patient_birthdate: patientRow.birthday || null,
      patient_age: patientRow.age ?? calcAge(patientRow.birthday as string | null) ?? null,
      patient_sex: patientRow.sex || null,
      patient_address: patientRow.address || null,
      diagnosis_source: diagnosisSource || (body.diagnosis_text ? "manual" : "consultation"),
      diagnosis_text: diagnosisText,
      remarks: body.remarks ?? null,
      advice: body.advice ?? null,
      findings_summary: body.findings_summary ?? null,
      physical_exam: physicalExam,
      supporting_data: supportingData,
      patient_snapshot: patientRow,
      consultation_snapshot: {
        consultation: consultationRow,
        diagnoses: diagnosisRows,
        notes: notesRow ?? null,
        vitals: vitalsRow ?? null,
      },
      doctor_snapshot: doctorSnapshot,
      doctor_id: certificateDoctorId,
      doctor_branch: consultationRow.branch || doctor.branch,
      qr_token: qrToken,
      verification_code: verificationCode,
      created_by_doctor_id: certificateDoctorId,
      created_at: issuedAt.toISOString(),
      updated_at: issuedAt.toISOString(),
    };

    const inserted = await db
      .from("medical_certificates")
      .insert(certificatePayload)
      .select("*")
      .single();

    if (inserted.error) {
      return NextResponse.json({ error: inserted.error.message }, { status: 400 });
    }

    const certificate = inserted.data as MedicalCertificateRow;

    if (supportingData.length > 0) {
      const detailRows = supportingData.map((entry, idx) => ({
        certificate_id: certificate.id,
        ordinal: idx,
        source_type: entry.type,
        source_id: entry.source_id || null,
        label: entry.label,
        summary: entry.summary,
        payload: entry.payload || null,
      }));
      await db.from("medical_certificate_supporting_items").insert(detailRows);
    }

    return NextResponse.json({ certificate });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to create certificate" },
      { status: 500 },
    );
  }
}

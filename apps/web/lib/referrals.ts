import "server-only";

import { getSupabase, sbReadPatientById } from "@/lib/supabase";
import { buildAllReports } from "@/lib/api/patient-results-core";

export type ReferralDoctorSnapshot = {
  id: string;
  full_name: string | null;
  credentials: string | null;
  prc_no: string | null;
};

export type ReferralSpecialtySnapshot = {
  id: string;
  code: string | null;
  name: string | null;
};

export type ReferralAffiliationSnapshot = {
  id: string;
  referral_doctor_affiliation_id: string | null;
  snapshot_text: string;
  sort_order: number | null;
  created_at: string | null;
};

export type ReferralPatientSnapshot = {
  patient_id: string;
  full_name: string | null;
  birthday: string | null;
  age: number | null;
  sex: string | null;
  address: string | null;
};

export type ReferralNotesSnapshot = {
  consultation_id: string;
  visit_at: string | null;
  notes_markdown: string | null;
  notes_soap: Record<string, any> | null;
};

export type ReferralVitalsSnapshot = {
  id: string;
  measured_at: string | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  hr: number | null;
  rr: number | null;
  temp_c: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  o2sat: number | null;
  blood_glucose_mgdl: number | null;
  notes: string | null;
  source: string | null;
  created_by_initials: string | null;
  created_at: string | null;
};

export type ReferralLabSnapshot = {
  report: Record<string, any>;
  config?: Record<string, string> | null;
  patientOnly?: boolean;
};

export type ReferralPatientHistory = {
  chief_complaint: string | null;
  present_illness_history: string | null;
  past_medical_history: string | null;
  past_surgical_history: string | null;
  allergies_text: string | null;
  medications_current: string | null;
  medications: string | null;
  family_hx: string | null;
  family_history: string | null;
};

export type ReferralPayload = {
  referral: Record<string, any>;
  patient: ReferralPatientSnapshot | null;
  patientHistory: ReferralPatientHistory | null;
  referredBy: ReferralDoctorSnapshot | null;
  referredTo: ReferralDoctorSnapshot | null;
  specialty: ReferralSpecialtySnapshot | null;
  affiliations: ReferralAffiliationSnapshot[];
  latestNotes: ReferralNotesSnapshot | null;
  latestLabs: ReferralLabSnapshot | null;
  vitalsSnapshots: ReferralVitalsSnapshot[] | null;
};

function normalizePatientId(value?: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function toNum(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toText(value: any): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export function formatAffiliationSnapshot(input?: {
  institution_name?: string | null;
  address_line?: string | null;
  contact_numbers?: string | null;
  schedule_text?: string | null;
}) {
  if (!input) return null;
  const lines = [
    String(input.institution_name || "").trim(),
    String(input.address_line || "").trim(),
    String(input.contact_numbers || "").trim(),
    String(input.schedule_text || "").trim(),
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

function buildPatientHistory(row?: Record<string, any> | null): ReferralPatientHistory | null {
  if (!row) return null;
  const history: ReferralPatientHistory = {
    chief_complaint: toText(row.chief_complaint),
    present_illness_history: toText(row.present_illness_history),
    past_medical_history: toText(row.past_medical_history),
    past_surgical_history: toText(row.past_surgical_history),
    allergies_text: toText(row.allergies_text),
    medications_current: toText(row.medications_current),
    medications: toText(row.medications),
    family_hx: toText(row.family_hx),
    family_history: toText(row.family_history),
  };
  const hasAny = Object.values(history).some((value) => value);
  return hasAny ? history : null;
}

export async function readLatestCompletedNotes(patientId: string): Promise<ReferralNotesSnapshot | null> {
  const pid = normalizePatientId(patientId);
  if (!pid) return null;
  const db = getSupabase();

  const cons = await db
    .from("consultations")
    .select("id, visit_at, status, signing_doctor_id, signing_doctor_name, finalized_at")
    .eq("patient_id", pid)
    .order("visit_at", { ascending: false })
    .limit(12);

  if (cons.error || !cons.data?.length) return null;

  const consults = cons.data as Array<{
    id: string;
    visit_at: string | null;
    status: string | null;
    signing_doctor_id: string | null;
    signing_doctor_name: string | null;
    finalized_at: string | null;
  }>;

  const ids = consults.map((c) => c.id);
  const signedRx = await db
    .from("prescriptions")
    .select("consultation_id")
    .in("consultation_id", ids)
    .eq("status", "signed")
    .eq("active", true);

  const signedSet = new Set<string>();
  if (!signedRx.error && signedRx.data) {
    for (const row of signedRx.data as Array<{ consultation_id: string }>) {
      if (row.consultation_id) signedSet.add(row.consultation_id);
    }
  }

  const doneConsult = consults.find((c) => {
    const status = String(c.status || "").toLowerCase();
    const isDone = status === "done" || status === "final";
    const hasSigner = !!(c.signing_doctor_id || c.signing_doctor_name);
    const hasFinalize = !!c.finalized_at;
    const hasSignedRx = signedSet.has(c.id);
    return isDone || hasSigner || hasFinalize || hasSignedRx;
  });

  if (!doneConsult) return null;

  const notes = await db
    .from("doctor_notes")
    .select("notes_markdown, notes_soap")
    .eq("consultation_id", doneConsult.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (notes.error || !notes.data) {
    return {
      consultation_id: doneConsult.id,
      visit_at: doneConsult.visit_at ?? null,
      notes_markdown: null,
      notes_soap: null,
    };
  }

  return {
    consultation_id: doneConsult.id,
    visit_at: doneConsult.visit_at ?? null,
    notes_markdown: notes.data.notes_markdown ?? null,
    notes_soap: (notes.data.notes_soap as Record<string, any>) ?? null,
  };
}

export async function readLatestLabs(patientId: string): Promise<ReferralLabSnapshot | null> {
  const pid = normalizePatientId(patientId);
  if (!pid) return null;
  const json = await buildAllReports(pid, 1);
  const report = json?.reports?.[0];
  if (!report) return null;
  return {
    report,
    config: (json?.config as Record<string, string>) ?? null,
    patientOnly: json?.patientOnly ?? false,
  };
}

export async function readLatestVitals(
  patientId: string,
  opts?: { consultationId?: string | null; encounterId?: string | null },
): Promise<ReferralVitalsSnapshot | null> {
  if (opts?.encounterId) {
    const snapshots = await readVitalsSnapshots(patientId, {
      encounterId: opts.encounterId,
      limit: 1,
    });
    if (snapshots[0]) return snapshots[0];
  }
  if (opts?.consultationId) {
    const snapshots = await readVitalsSnapshots(patientId, {
      consultationId: opts.consultationId,
      limit: 1,
    });
    if (snapshots[0]) return snapshots[0];
  }
  const snapshots = await readVitalsSnapshots(patientId, { limit: 1 });
  return snapshots[0] ?? null;
}

export async function readVitalsSnapshots(
  patientId: string,
  opts?: { consultationId?: string | null; encounterId?: string | null; limit?: number },
): Promise<ReferralVitalsSnapshot[]> {
  const pid = normalizePatientId(patientId);
  if (!pid) return [];
  const db = getSupabase();

  let query = db
    .from("vitals_snapshots")
    .select(
      "id, measured_at, systolic_bp, diastolic_bp, hr, rr, temp_c, weight_kg, height_cm, bmi, o2sat, blood_glucose_mgdl, notes, source, created_by_initials, created_at",
    )
    .eq("patient_id", pid)
    .order("measured_at", { ascending: false });

  if (opts?.encounterId) query = query.eq("encounter_id", opts.encounterId);
  if (opts?.consultationId) query = query.eq("consultation_id", opts.consultationId);
  query = query.limit(opts?.limit ?? 20);

  const res = await query;
  if (res.error || !res.data) return [];

  return (res.data as Array<Record<string, any>>).map((row) => {
    const heightCm = toNum(row.height_cm);
    const weightKg = toNum(row.weight_kg);
    const bmi = toNum(row.bmi);
    const derivedBmi =
      bmi ??
      (heightCm && weightKg
        ? Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10
        : null);

    return {
      id: String(row.id ?? ""),
      measured_at: row.measured_at ?? null,
      systolic_bp: toNum(row.systolic_bp),
      diastolic_bp: toNum(row.diastolic_bp),
      hr: toNum(row.hr),
      rr: toNum(row.rr),
      temp_c: toNum(row.temp_c),
      weight_kg: weightKg,
      height_cm: heightCm,
      bmi: derivedBmi,
      o2sat: toNum(row.o2sat),
      blood_glucose_mgdl: toNum(row.blood_glucose_mgdl),
      notes: toText(row.notes),
      source: toText(row.source),
      created_by_initials: toText(row.created_by_initials),
      created_at: toText(row.created_at),
    };
  });
}

export async function buildReferralPayload(referralId: string): Promise<ReferralPayload | null> {
  if (!referralId) return null;
  const db = getSupabase();

  const referralRes = await db
    .from("patient_referrals")
    .select(
      [
        "id",
        "referral_code",
        "patient_id",
        "encounter_id",
        "consult_id",
        "referred_by_doctor_id",
        "referred_to_doctor_id",
        "referred_to_specialty_id",
        "referred_to_affiliation_id",
        "include_latest_notes",
        "include_latest_labs",
        "include_latest_vitals",
        "include_patient_history",
        "snapshot_affiliation_text",
        "notes",
        "created_at",
      ].join(", "),
    )
    .eq("id", referralId)
    .maybeSingle();

  if (referralRes.error || !referralRes.data) return null;
  const referral = referralRes.data as Record<string, any>;

  const patientId = normalizePatientId(referral.patient_id);
  if (!patientId) return null;

  let patientRow: Record<string, any> | null = null;
  try {
    patientRow = (await sbReadPatientById(patientId)) as Record<string, any> | null;
  } catch (err) {
    console.error("referral_patient_load_failed", {
      referral_id: referralId,
      patient_id: patientId,
    });
  }
  const patient = patientRow
    ? ({
        patient_id: patientRow.patient_id,
        full_name: patientRow.full_name ?? null,
        birthday: patientRow.birthday ?? null,
        age: patientRow.age ?? null,
        sex: patientRow.sex ?? null,
        address: patientRow.address ?? null,
      } as ReferralPatientSnapshot)
    : null;

  const patientHistory = referral.include_patient_history ? buildPatientHistory(patientRow) : null;

  const referredByRes = await db
    .from("doctors")
    .select("doctor_id, full_name, display_name, credentials, prc_no")
    .eq("doctor_id", referral.referred_by_doctor_id)
    .maybeSingle();

  const referredBy = referredByRes.data
    ? ({
        id: referredByRes.data.doctor_id,
        full_name: referredByRes.data.full_name ?? referredByRes.data.display_name ?? null,
        credentials: referredByRes.data.credentials ?? null,
        prc_no: referredByRes.data.prc_no ?? null,
      } as ReferralDoctorSnapshot)
    : null;

  const referredToRes = await db
    .from("referral_doctors")
    .select("id, full_name, credentials, prc_no, specialty_id")
    .eq("id", referral.referred_to_doctor_id)
    .maybeSingle();

  const referredTo = referredToRes.data
    ? ({
        id: referredToRes.data.id,
        full_name: referredToRes.data.full_name ?? null,
        credentials: referredToRes.data.credentials ?? null,
        prc_no: referredToRes.data.prc_no ?? null,
      } as ReferralDoctorSnapshot)
    : null;

  const specialtyRes = await db
    .from("referral_specialties")
    .select("id, code, name")
    .eq("id", referral.referred_to_specialty_id)
    .maybeSingle();

  const specialty = specialtyRes.data
    ? ({
        id: specialtyRes.data.id,
        code: specialtyRes.data.code ?? null,
        name: specialtyRes.data.name ?? null,
      } as ReferralSpecialtySnapshot)
    : null;

  const affiliationsRes = await db
    .from("patient_referral_affiliations")
    .select("id, referral_doctor_affiliation_id, snapshot_text, sort_order, created_at")
    .eq("referral_id", referralId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  let affiliations: ReferralAffiliationSnapshot[] = [];
  if (!affiliationsRes.error && affiliationsRes.data) {
    affiliations = affiliationsRes.data.map((row) => ({
      id: String(row.id ?? ""),
      referral_doctor_affiliation_id: row.referral_doctor_affiliation_id ?? null,
      snapshot_text: String(row.snapshot_text ?? "").trim(),
      sort_order: row.sort_order ?? null,
      created_at: row.created_at ?? null,
    }));
  }

  if (affiliations.length === 0 && referral.snapshot_affiliation_text) {
    affiliations = [
      {
        id: `legacy-${referral.id}`,
        referral_doctor_affiliation_id: referral.referred_to_affiliation_id ?? null,
        snapshot_text: String(referral.snapshot_affiliation_text || "").trim(),
        sort_order: null,
        created_at: referral.created_at ?? null,
      },
    ];
  }

  const latestNotes = referral.include_latest_notes
    ? await readLatestCompletedNotes(patientId)
    : null;
  const latestLabs = referral.include_latest_labs ? await readLatestLabs(patientId) : null;
  const vitalsSnapshots = referral.include_latest_vitals
    ? await readVitalsSnapshots(patientId)
    : null;

  return {
    referral,
    patient,
    patientHistory,
    referredBy,
    referredTo,
    specialty,
    affiliations,
    latestNotes,
    latestLabs,
    vitalsSnapshots,
  };
}

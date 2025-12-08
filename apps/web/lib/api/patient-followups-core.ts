import { getSupabase } from "@/lib/supabase";

type FollowupRow = {
  id: string;
  patient_id: string;
  created_from_consultation_id?: string | null;
  return_branch: string | null;
  due_date: string;
  valid_until?: string | null;
  intended_outcome?: string | null;
  expected_tests?: string | null;
  status: "scheduled" | "completed" | "canceled" | "skipped";
};

type ConsultationRow = {
  doctor_id?: string | null;
  signing_doctor_name?: string | null;
  doctor_name_at_time?: string | null;
};

type DoctorRow = {
  display_name?: string | null;
  full_name?: string | null;
  credentials?: string | null;
};

export type PatientFollowup = FollowupRow & {
  doctor_name?: string | null;
  doctor_name_plain?: string | null;
};

function formatDoctorName(
  doctor: DoctorRow | null,
  signing: string | null,
  reliever: string | null
) {
  const cred = doctor?.credentials?.trim();
  const base =
    doctor?.full_name?.trim() ||
    doctor?.display_name?.trim() ||
    signing?.trim() ||
    reliever?.trim() ||
    null;

  const withCred =
    base && cred && !new RegExp(`,\\s*${cred}$`).test(base) ? `${base}, ${cred}` : base;

  return {
    doctor_name: withCred,
    doctor_name_plain: base,
  };
}

export async function getPatientFollowup(patientId: string): Promise<PatientFollowup | null> {
  const supa = getSupabase();

  const { data, error } = await supa
    .from("followups")
    .select(
      `
        id,
        patient_id,
        created_from_consultation_id,
        return_branch,
        due_date,
        valid_until,
        intended_outcome,
        expected_tests,
        status
      `
    )
    .eq("patient_id", patientId)
    .eq("status", "scheduled")
    .is("deleted_at", null)
    .order("due_date", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);

  const row: FollowupRow | undefined = (data ?? [])[0];
  if (!row) return null;

  let doctor: DoctorRow | null = null;
  let consult: ConsultationRow | null = null;

  if (row.created_from_consultation_id) {
    const { data: cons, error: consErr } = await supa
      .from("consultations")
      .select("doctor_id, signing_doctor_name, doctor_name_at_time")
      .eq("id", row.created_from_consultation_id)
      .maybeSingle();

    if (consErr) throw consErr;
    consult = cons as ConsultationRow | null;

    if (consult?.doctor_id) {
      const { data: doc, error: docErr } = await supa
        .from("doctors")
        .select("display_name, full_name, credentials")
        .eq("doctor_id", consult.doctor_id)
        .maybeSingle();

      if (docErr) throw docErr;
      doctor = (doc as DoctorRow | null) ?? null;
    }
  }

  const doc = formatDoctorName(
    doctor,
    consult?.signing_doctor_name ?? null,
    consult?.doctor_name_at_time ?? null
  );

  return {
    ...row,
    doctor_name: doc.doctor_name,
    doctor_name_plain: doc.doctor_name_plain,
  };
}

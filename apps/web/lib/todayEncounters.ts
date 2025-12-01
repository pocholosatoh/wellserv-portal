import { getSupabase } from "@/lib/supabase";

const DEFAULT_TZ = process.env.APP_TZ || "Asia/Manila";

export type TodayEncounterRow = {
  id: string;
  patient_id: string;
  branch_code: string;
  status: string | null;
  priority: number | null;
  notes_frontdesk: string | null;
  visit_date_local: string | null;
  total_price: number | null;
  is_philhealth_claim: boolean;
  yakap_flag: boolean;
  consult_status: string | null;
  queue_number: number | null;
  for_consult: boolean;
  full_name: string;
  contact: string | null;
};

export function todayISOin(tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type FetchOpts = {
  branch: "SI" | "SL";
  consultOnly?: boolean;
  includeDone?: boolean;
};

export async function readTodayEncounters({
  branch,
  consultOnly = false,
  includeDone = false,
}: FetchOpts): Promise<TodayEncounterRow[]> {
  const supabase = getSupabase();
  const today = todayISOin();

  let query = supabase
    .from("encounters")
    .select(
      "id, patient_id, branch_code, status, priority, notes_frontdesk, visit_date_local, total_price, is_philhealth_claim, yakap_flag, consult_status, queue_number, for_consult"
    )
    .eq("branch_code", branch)
    .eq("visit_date_local", today);

  if (consultOnly) {
    const states = includeDone
      // include legacy "in-progress" in case older rows still use it
      ? ["queued_for_consult", "in_consult", "in-progress", "done"]
      : ["queued_for_consult", "in_consult", "in-progress"];
    query = query
      .in("consult_status", states)
      .order("queue_number", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("priority", { ascending: false });
  }

  const { data: encs, error: encError } = await query;
  if (encError) throw encError;

  const rows = encs || [];
  if (!rows.length) return [];

  const patientIds = Array.from(new Set(rows.map((r) => r.patient_id))).filter(Boolean);
  let patients: { patient_id: string; full_name: string; contact: string | null }[] = [];

  if (patientIds.length) {
    const { data: pats, error: patError } = await supabase
      .from("patients")
      .select("patient_id, full_name, contact")
      .in("patient_id", patientIds);
    if (patError) throw patError;
    patients = pats || [];
  }

  const patientMap = new Map(
    patients.map((p) => [
      p.patient_id,
      {
        full_name: p.full_name || "",
        contact: p.contact || null,
      },
    ])
  );

  const list = consultOnly
    ? [...rows].sort((a, b) => {
        const an = a.queue_number ?? Number.POSITIVE_INFINITY;
        const bn = b.queue_number ?? Number.POSITIVE_INFINITY;
        return an - bn;
      })
    : rows;

  return list.map((r: any) => ({
    id: r.id,
    patient_id: r.patient_id,
    branch_code: r.branch_code,
    status: r.status ?? null,
    priority: r.priority ?? null,
    notes_frontdesk: r.notes_frontdesk ?? null,
    visit_date_local: r.visit_date_local ?? null,
    total_price: r.total_price ?? null,
    is_philhealth_claim: !!r.is_philhealth_claim,
    yakap_flag: !!r.yakap_flag,
    consult_status: r.consult_status ?? null,
    queue_number: r.queue_number ?? null,
    for_consult: !!r.for_consult,
    full_name: patientMap.get(r.patient_id)?.full_name || "",
    contact: patientMap.get(r.patient_id)?.contact || "",
  }));
}

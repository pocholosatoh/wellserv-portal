// app/(doctor)/doctor/patient/[patientId]/page.tsx
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Link from "next/link";
import { getDoctorSession } from "@/lib/doctorSession";
import { getSupabase } from "@/lib/supabase";
import { readTodayEncounters } from "@/lib/todayEncounters";

import ClientReportViewer from "./ClientReportViewer";
import PastConsultations from "./PastConsultations";
import LogoutButton from "@/app/(doctor)/doctor/LogoutButton";
import OtherLabsCard from "./OtherLabsCard";
// import QuickPatientJump from "./QuickPatientJump";
import ConsultationSection from "./ConsultationSection";
import DiagnosisPanel from "./DiagnosisPanel";
import ConsentBus from "./ConsentBus";
import ConsultQueueModal from "./ConsultQueueModal";
import PatientSelfMonitoringCard from "./PatientSelfMonitoringCard";
import FollowUpPanel from "./FollowUpPanel";
import ContinuityOfCareModal from "./ContinuityOfCareModal";
import VitalsSnapshot from "./VitalsSnapshot";
import ReferralPanel from "./ReferralPanel";

type DoctorLite = {
  display_name?: string | null;
  full_name?: string | null;
  credentials?: string | null;
};

type ConsultSummary = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_at: string;
  plan_shared: boolean | null;
  doctor_name_at_time?: string | null;
  doctor?: DoctorLite | null;
};

type ConsultDetails = {
  id: string;
  patient_id: string;
  visit_at: string;
  plan_shared: boolean | null;
  doctor?: DoctorLite | null;
  doctor_name_at_time?: string | null;
  signing_doctor_name?: string | null;
  notes?: {
    notes_markdown?: string | null;
    notes_soap?: any | null;
  } | null;
  rx?: {
    id: string;
    status: string | null;
    notes_for_patient?: string | null;
    valid_days?: number | null;
    valid_until?: string | null;
    items: Array<{
      generic_name: string | null;
      brand_name: string | null;
      strength: string | null;
      form: string | null;
      quantity: number | null;
      unit_price: number | null;
    }>;
  } | null;
};

type RxItem = {
  generic_name: string | null;
  brand_name: string | null;
  strength: string | null;
  form: string | null;
  quantity: number | null;
  unit_price: number | null;
};

type FollowupRow = {
  id: string;
  patient_id: string;
  due_date: string;
  return_branch: string | null;
  intended_outcome?: string | null;
  expected_tests?: string | null;
  status: "scheduled" | "completed" | "canceled" | "skipped";
  created_at?: string | null;
  valid_until?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
};

type PatientHeading = {
  fullName: string | null;
  age: number | null;
  sex: string | null;
};

function isUuid(v?: string | null) {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeLikeExact(input: string) {
  return input.replace(/[%_]/g, (m) => `\\${m}`);
}

function formatDoctorName(row: DoctorLite | null) {
  if (!row) return null;
  const base = (row.display_name || row.full_name || "").trim();
  if (!base) return null;
  const cred = (row.credentials || "").trim();
  if (cred) {
    const suffix = new RegExp(`,\\s*${escapeRegExp(cred)}$`);
    if (!suffix.test(base)) return `${base}, ${cred}`;
  }
  return base;
}

function parseYmd(ymd?: string | null) {
  if (!ymd) return null;
  const match = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function calcAge(birthYmd: string | null | undefined, todayYmd: string): number | null {
  const birth = parseYmd(birthYmd);
  const today = parseYmd(todayYmd);
  if (!birth || !today) return null;
  let age = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

async function readPastConsultations(
  db: ReturnType<typeof getSupabase>,
  patientId: string,
): Promise<ConsultSummary[]> {
  const cons = await db
    .from("consultations")
    .select("id, patient_id, doctor_id, visit_at, plan_shared, doctor_name_at_time")
    .eq("patient_id", patientId)
    .order("visit_at", { ascending: false });

  if (cons.error) throw cons.error;
  const rows = cons.data || [];
  const doctorIds = Array.from(new Set(rows.map((r) => r.doctor_id).filter(Boolean))) as string[];

  let doctorMap: Record<string, DoctorLite> = {};
  if (doctorIds.length) {
    const docs = await db
      .from("doctors")
      .select("doctor_id, display_name, full_name, credentials")
      .in("doctor_id", doctorIds);
    if (!docs.error && docs.data) {
      for (const d of docs.data) {
        doctorMap[d.doctor_id] = {
          display_name: d.display_name,
          full_name: d.full_name,
          credentials: d.credentials,
        };
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    patient_id: r.patient_id,
    doctor_id: r.doctor_id,
    visit_at: r.visit_at,
    plan_shared: r.plan_shared ?? false,
    doctor_name_at_time: r.doctor_name_at_time ?? null,
    doctor: r.doctor_id ? (doctorMap[r.doctor_id] ?? null) : null,
  }));
}

async function readConsultationDetails(
  db: ReturnType<typeof getSupabase>,
  id: string,
): Promise<ConsultDetails | null> {
  const c = await db
    .from("consultations")
    .select(
      "id, patient_id, doctor_id, visit_at, plan_shared, doctor_name_at_time, signing_doctor_name",
    )
    .eq("id", id)
    .maybeSingle();

  if (c.error || !c.data) return null;

  let doctor: DoctorLite | null = null;
  if (c.data.doctor_id) {
    const d = await db
      .from("doctors")
      .select("display_name, full_name, credentials")
      .eq("doctor_id", c.data.doctor_id)
      .maybeSingle();
    doctor = d.error ? null : (d.data ?? null);
  }

  const dn = await db
    .from("doctor_notes")
    .select("notes_markdown, notes_soap")
    .eq("consultation_id", id)
    .order("updated_at", { ascending: false })
    .maybeSingle();

  let rxId: string | null = null;
  let rxStatus: string | null = null;
  let rxNotes: string | null = null;
  let rxValidDays: number | null = null;
  let rxValidUntil: string | null = null;

  const signed = await db
    .from("prescriptions")
    .select("id, status, notes_for_patient, updated_at, valid_days, valid_until")
    .eq("consultation_id", id)
    .eq("status", "signed")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .maybeSingle();

  if (signed.data?.id) {
    rxId = signed.data.id;
    rxStatus = signed.data.status;
    rxNotes = signed.data.notes_for_patient ?? null;
    rxValidDays = signed.data.valid_days ?? null;
    rxValidUntil = signed.data.valid_until ?? null;
  } else {
    const draft = await db
      .from("prescriptions")
      .select("id, status, notes_for_patient, updated_at, valid_days")
      .eq("consultation_id", id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .maybeSingle();

    if (draft.data?.id) {
      rxId = draft.data.id;
      rxStatus = draft.data.status;
      rxNotes = draft.data.notes_for_patient ?? null;
      rxValidDays = draft.data.valid_days ?? null;
      rxValidUntil = null;
    }
  }

  let items: RxItem[] = [];
  if (rxId) {
    const lines = await db
      .from("prescription_items")
      .select("generic_name, brand_name, strength, form, quantity, unit_price")
      .eq("prescription_id", rxId)
      .order("created_at", { ascending: true });
    items = lines.error ? [] : ((lines.data ?? []) as RxItem[]);
  }

  return {
    id: c.data.id,
    patient_id: c.data.patient_id,
    visit_at: c.data.visit_at,
    plan_shared: c.data.plan_shared ?? false,
    doctor,
    doctor_name_at_time: c.data.doctor_name_at_time ?? null,
    signing_doctor_name: c.data.signing_doctor_name ?? null,
    notes: {
      notes_markdown: dn.data?.notes_markdown ?? null,
      notes_soap: dn.data?.notes_soap ?? null,
    },
    rx: rxId
      ? {
          id: rxId,
          status: rxStatus,
          notes_for_patient: rxNotes,
          items,
          valid_days: rxValidDays,
          valid_until: rxValidUntil,
        }
      : null,
  };
}

async function readFollowups(
  db: ReturnType<typeof getSupabase>,
  patientId: string,
  branch: "SI" | "SL",
): Promise<FollowupRow[]> {
  const start = "1900-01-01";
  const end = "2100-01-01";
  let q = db
    .from("followups")
    .select(
      "id, patient_id, return_branch, due_date, intended_outcome, expected_tests, status, created_at, valid_until, created_by, updated_by",
    )
    .is("deleted_at", null)
    .gte("due_date", start)
    .lte("due_date", end)
    .order("due_date", { ascending: true });

  if (branch === "SI" || branch === "SL") {
    const legacyText = branch === "SL" ? "San Leonardo%" : "San Isidro%";
    q = q.or([`return_branch.eq.${branch}`, `return_branch.ilike.${legacyText}`].join(","));
  }

  if (patientId) q = q.ilike("patient_id", escapeLikeExact(patientId));

  const { data, error } = await q;
  if (error) throw error;

  const rows: FollowupRow[] = (data ?? []) as FollowupRow[];
  const doctorIds = new Set<string>();
  rows.forEach((row) => {
    if (isUuid(row?.created_by)) doctorIds.add(row.created_by as string);
    if (isUuid(row?.updated_by)) doctorIds.add(row.updated_by as string);
  });

  const doctorMap = new Map<string, string>();
  if (doctorIds.size) {
    const { data: docs, error: docErr } = await db
      .from("doctors")
      .select("doctor_id, display_name, full_name, credentials")
      .in("doctor_id", Array.from(doctorIds));
    if (!docErr && docs) {
      (docs || []).forEach((doc: any) => {
        const label = formatDoctorName({
          display_name: doc.display_name,
          full_name: doc.full_name,
          credentials: doc.credentials,
        });
        if (label) doctorMap.set(doc.doctor_id, label);
      });
    }
  }

  return rows.map((row) => ({
    ...row,
    created_by_name: isUuid(row?.created_by) ? doctorMap.get(row.created_by as string) || null : null,
    updated_by_name: isUuid(row?.updated_by) ? doctorMap.get(row.updated_by as string) || null : null,
  }));
}

async function readPatientHeading(
  db: ReturnType<typeof getSupabase>,
  patientId: string,
  todayYmd: string,
): Promise<PatientHeading> {
  const { data, error } = await db
    .from("patients")
    .select("patient_id, full_name, sex, birthday")
    .ilike("patient_id", escapeLikeExact(patientId))
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { fullName: null, age: null, sex: null };
  }

  const fullName = String(data.full_name || "").trim() || null;
  const sex = String(data.sex || "").trim() || null;
  const birthday = data.birthday ? String(data.birthday) : null;
  const age = calcAge(birthday, todayYmd);

  return { fullName, age, sex };
}

async function readSelfMonitoringPrescribed(
  db: ReturnType<typeof getSupabase>,
  patientId: string,
): Promise<boolean | null> {
  const { data, error } = await db
    .from("patient_self_monitoring")
    .select("id")
    .ilike("patient_id", escapeLikeExact(patientId))
    .eq("enabled", true)
    .eq("doctor_requested", true)
    .limit(1);
  if (error) return null;
  return Array.isArray(data) && data.length > 0;
}

type Props = {
  params: Promise<{ patientId: string }>; // Next 15: async
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DoctorPatientPage({ params, searchParams }: Props) {
  const session = await getDoctorSession();
  const { patientId } = await params; // await first in Next 15
  const patientIdUpper = patientId.toUpperCase();

  if (!session) {
    const nextUrl = `/doctor/patient/${encodeURIComponent(patientId)}`;
    redirect(`/doctor/login?next=${encodeURIComponent(nextUrl)}`);
  }

  const branch = session.branch as "SI" | "SL";
  const sp = (await searchParams) || {};
  const requestedConsultationId = (Array.isArray(sp.c) ? sp.c[0] : sp.c) || null;

  const db = getSupabase();
  const tz = process.env.APP_TZ || "Asia/Manila";
  const fmtYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayYmd = fmtYmd.format(new Date());

  const withinToday = (iso: string | null | undefined) => {
    if (!iso) return false;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.valueOf())) return false;
    return fmtYmd.format(parsed) === todayYmd;
  };

  let initialConsultationId: string | null = requestedConsultationId;

  if (initialConsultationId) {
    const { data, error } = await db
      .from("consultations")
      .select("id, visit_at")
      .eq("id", initialConsultationId)
      .maybeSingle();

    if (error || !data?.id || !withinToday(data.visit_at as string | null)) {
      initialConsultationId = null;
    }
  }

  if (!initialConsultationId) {
    const { data } = await db
      .from("consultations")
      .select("id, visit_at")
      .eq("patient_id", patientIdUpper)
      .gte("visit_at", `${todayYmd}T00:00:00+08:00`)
      .lte("visit_at", `${todayYmd}T23:59:59.999+08:00`)
      .order("visit_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id && withinToday(data.visit_at as string | null)) {
      initialConsultationId = data.id;
    }
  }

  const docName =
    session!.display_name ||
    (session!.credentials ? `${session!.name}, ${session!.credentials}` : session!.name);
  const branchName = branch === "SL" ? "San Leonardo" : "San Isidro";
  const consultQueuePromise = readTodayEncounters({
    branch,
    consultOnly: true,
    includeDone: true,
  });
  const continuityConsultsPromise = readPastConsultations(db, patientIdUpper).catch(() => []);
  const continuityFollowupsPromise = readFollowups(db, patientIdUpper, branch).catch(() => []);
  const continuitySelfMonitoringPromise = readSelfMonitoringPrescribed(db, patientIdUpper).catch(
    () => null,
  );
  const patientHeadingPromise = readPatientHeading(db, patientIdUpper, todayYmd).catch(() => ({
    fullName: null,
    age: null,
    sex: null,
  }));

  const [
    consultQueue,
    continuityConsults,
    continuityFollowups,
    selfMonitoringPrescribed,
    patientHeading,
  ] = await Promise.all([
    consultQueuePromise,
    continuityConsultsPromise,
    continuityFollowupsPromise,
    continuitySelfMonitoringPromise,
    patientHeadingPromise,
  ]);

  const latestConsultationDetails: ConsultDetails | null = continuityConsults.length
    ? await readConsultationDetails(db, continuityConsults[0].id).catch(() => null)
    : null;

  return (
    <div
      className="
      w-full mx-auto
      max-w-[1720px]
      px-4 sm:px-6 lg:px-8 2xl:px-12
      pt-4 sm:pt-6 pb-8
      space-y-6
    "
    >
      <ConsentBus patientId={patientIdUpper} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Link
            href="/doctor"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <span className="text-lg leading-none">←</span>
            Back to Home
          </Link>
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">
              Patient Workspace <span className="text-xs align-middle text-[#44969b]">v1</span>
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Patient ID: <b>{patientIdUpper}</b>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <ConsultQueueModal queue={consultQueue} branch={branch} currentPatientId={patientId} />
          <ContinuityOfCareModal
            patientId={patientIdUpper}
            consultations={continuityConsults}
            latestConsultationDetails={latestConsultationDetails}
            followups={continuityFollowups}
            selfMonitoringPrescribed={selfMonitoringPrescribed}
            patientHeading={patientHeading}
          />
          {/* <QuickPatientJump accent="#44969b" />*/}
          <span className="text-sm text-gray-700">
            Signed in as <b>{docName}</b>
          </span>
          <LogoutButton />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column: results + other labs */}
        <div className="lg:col-span-7 space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Lab Results</h2>
            </header>
            <div className="p-4">
              <ClientReportViewer patientId={patientIdUpper} />
            </div>
          </section>

          <VitalsSnapshot patientId={patientIdUpper} />

          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Other Labs</h2>
            </header>
            <div className="p-4">
              <OtherLabsCard patientId={patientIdUpper} showHeader={false} />
            </div>
          </section>
        </div>

        {/* Right column: doctor actions */}
        <div className="lg:col-span-5 space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Notes, Prescriptions & Diagnoses</h2>
            </header>
            <div className="p-4 space-y-6">
              <ConsultationSection
                patientId={patientIdUpper}
                initialConsultationId={initialConsultationId} // can be null; your StartConsultBar handles it
                defaultBranch={branchName}
              />

              {/* Diagnoses Panel (auto-picks up today's consultation or via Refresh) */}
              <DiagnosisPanel
                patientId={patientIdUpper}
                initialConsultationId={initialConsultationId}
              />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Schedule Follow-Up</h2>
            </header>
            <div className="p-4">
              <FollowUpPanel
                patientId={patientIdUpper}
                consultationId={initialConsultationId}
                defaultBranch={branchName}
                doctorId={session.doctorId}
                initialFollowups={continuityFollowups}
              />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Referral</h2>
            </header>
            <div className="p-4">
              <ReferralPanel patientId={patientIdUpper} consultationId={initialConsultationId} />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Patient Self-Monitoring Prescription</h2>
            </header>
            <div className="p-4">
              <PatientSelfMonitoringCard
                patientId={patientIdUpper}
                initialConsultationId={initialConsultationId}
              />
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
        <header className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-gray-800">Past Consultations</h2>
        </header>
        <div className="p-4">
          <PastConsultations patientId={patientIdUpper} initialList={continuityConsults} />
        </div>
      </section>
    </div>
  );
}

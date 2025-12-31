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
import PatientSelfLogsCard from "./PatientSelfLogsCard";
import FollowUpPanel from "./FollowUpPanel";

type Props = {
  params: Promise<{ patientId: string }>; // Next 15: async
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DoctorPatientPage({ params, searchParams }: Props) {
  const session = await getDoctorSession();
  const { patientId } = await params; // await first in Next 15

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
      .eq("patient_id", patientId.toUpperCase())
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
  const consultQueue = await readTodayEncounters({
    branch,
    consultOnly: true,
    includeDone: true,
  });

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
      <ConsentBus patientId={patientId} />
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
              Patient ID: <b>{patientId.toUpperCase()}</b>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <ConsultQueueModal queue={consultQueue} branch={branch} currentPatientId={patientId} />
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
              <ClientReportViewer patientId={patientId} />
            </div>
          </section>

          <PatientSelfLogsCard patientId={patientId} />

          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Other Labs</h2>
            </header>
            <div className="p-4">
              <OtherLabsCard patientId={patientId} showHeader={false} />
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
                patientId={patientId}
                initialConsultationId={initialConsultationId} // can be null; your StartConsultBar handles it
                defaultBranch={branchName}
              />

              {/* Diagnoses Panel (auto-picks up today's consultation or via Refresh) */}
              <DiagnosisPanel patientId={patientId} initialConsultationId={initialConsultationId} />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Schedule Follow-Up</h2>
            </header>
            <div className="p-4">
              <FollowUpPanel
                patientId={patientId}
                consultationId={initialConsultationId}
                defaultBranch={branchName}
                doctorId={session.doctorId}
              />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Patient Self-Monitoring Prescription</h2>
            </header>
            <div className="p-4">
              <PatientSelfMonitoringCard
                patientId={patientId}
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
          <PastConsultations patientId={patientId} />
        </div>
      </section>
    </div>
  );
}

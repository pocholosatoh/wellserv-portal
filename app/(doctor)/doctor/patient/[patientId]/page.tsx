// app/(doctor)/doctor/patient/[patientId]/page.tsx
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/doctorSession";

import ClientReportViewer from "./ClientReportViewer";
import PastConsultations from "./PastConsultations";
import OtherLabsViewer from "@/components/OtherLabsViewer";
import LogoutButton from "@/app/(doctor)/doctor/LogoutButton";
import OtherLabsCard from "./OtherLabsCard";
import QuickPatientJump from "./QuickPatientJump";
import ConsultationSection from "./ConsultationSection"; // ✅ new composed section

type Props = { params: { patientId: string } };

export default async function DoctorPatientPage({ params }: Props) {
  const session = await getDoctorSession(); // ✅ server-side
  if (!session) {
    const nextUrl = `/doctor/patient/${encodeURIComponent(params.patientId)}`;
    redirect(`/doctor/login?next=${encodeURIComponent(nextUrl)}`);
  }

  const { patientId } = params;

  const docName =
    session!.display_name ||
    (session!.credentials ? `${session!.name}, ${session!.credentials}` : session!.name);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">
            Patient Workspace <span className="text-xs align-middle text-[#44969b]">v1</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Patient ID: <b>{patientId.toUpperCase()}</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuickPatientJump accent="#44969b" />
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

          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Other Labs</h2>
            </header>
            <div className="p-4">
              <OtherLabsCard showHeader={false}>
                <OtherLabsViewer patientId={patientId} showIfEmpty />
              </OtherLabsCard>
            </div>
          </section>
        </div>

        {/* Right column: Notes & Rx (gated by Start consultation) */}
        <section className="lg:col-span-5 rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
          <header className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-medium text-gray-800">Notes & Prescriptions</h2>
          </header>
          <div className="p-4 space-y-6">
            <ConsultationSection
              patientId={patientId}
              initialConsultationId={null} // keep null; doctor presses "Start consultation"
            />
          </div>
        </section>
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

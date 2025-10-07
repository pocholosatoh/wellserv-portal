// app/(doctor)/doctor/patient/[patientId]/page.tsx
import ClientReportViewer from "./ClientReportViewer";
import NotesPanel from "./NotesPanel";
import RxPanel from "./RxPanel";
import PastConsultations from "./PastConsultations";
import dynamic from "next/dynamic";
import OtherLabsViewer from "@/components/OtherLabsViewer";

type Props = { params: { patientId: string } };

export default async function DoctorPatientPage({ params }: Props) {
  const { patientId } = params;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Patient Workspace <span className="text-xs align-middle text-[#44969b]">v2</span>
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Patient ID: <b>{patientId}</b>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Lab Results + Other Labs */}
        <div className="lg:col-span-7 space-y-5">
          {/* Lab Results */}
          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Lab Results</h2>
            </header>
            <div className="p-4">
              <ClientReportViewer patientId={patientId} />
            </div>
          </section>

          {/* Other Labs (External uploads) */}
          <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Other Labs</h2>
            </header>
            <div className="p-4">
              {/* Hide the block automatically if none */}
              <OtherLabsViewer patientId={patientId} showIfEmpty={false} />
            </div>
          </section>
        </div>

        {/* Right: Notes + Prescription */}
        <section className="lg:col-span-5 rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
          <header className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-medium text-gray-800">Notes & Prescriptions</h2>
          </header>
          <div className="p-4 space-y-6">
            <div>
              <h3 className="font-medium mb-2">Doctor Notes</h3>
              <NotesPanel patientId={patientId} />
            </div>
            <div>
              <h3 className="font-medium mb-2">Prescription</h3>
              <RxPanel patientId={patientId} />
            </div>
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

// app/(patient)/results/page.tsx
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ResultsViewer from "@/components/ReportViewer";
import OtherLabsViewer from "@/components/OtherLabsViewer";

export default async function ResultsPage() {
  const session = await getSession();
  if (!session || session.role !== "patient") {
    redirect("/login?next=/results");
  }

  return (
    <main className="min-h-dvh bg-white">
      {/* Hide this sticky bar on print */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.05)] print:hidden">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
          <Link
            href="/patient"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            ← Back to Home
          </Link>
          <Link
            href="/prescriptions"
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(68,150,155,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(68,150,155,0.32)]"
            style={{ backgroundColor: process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b" }}
          >
            Check Prescriptions
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-10">
        <ResultsViewer
          autoFetch
          useSession
          apiPath="/api/patient-results"
          initialPatientId={session.patient_id}
          sessionPatientId={session.patient_id}
        />
        {/* Hide Other Labs only on print */}
        <div className="print:hidden">
          {/* Force the v2 API + add debug + longer expiry while testing */}
          <OtherLabsViewer
            showIfEmpty
            patientId={session.patient_id}
            apiPath={`/api/patient/other-labs-v2?expires=3600&v=${Date.now()}`}
          />
        </div>
      </div>
    </main>
  );
}

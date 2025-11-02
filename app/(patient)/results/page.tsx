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
    <main className="min-h-dvh">
      {/* Hide this sticky bar on print */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b print:hidden">
        <div className="mx-auto max-w-5xl flex items-center justify-between p-3">
          <Link href="/patient" className="rounded-lg border px-3 py-2">← Back to Home</Link>
          <Link
            href="/prescriptions"
            className="rounded-lg px-3 py-2 text-white"
            style={{ backgroundColor: (process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b") }}
          >
            Check Prescriptions
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4 space-y-6">
        <ResultsViewer autoFetch useSession apiPath="/api/patient-results" />
        {/* Hide Other Labs only on print */}
        <div className="print:hidden">
          {/* Force the v2 API + add debug + longer expiry while testing */}
          <OtherLabsViewer
            showIfEmpty
            useSession
            apiPath={`/api/patient/other-labs-v2?expires=3600&v=${Date.now()}`}
          />
        </div>
      </div>
    </main>
  );
}

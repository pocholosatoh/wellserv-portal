// app/(doctor)/doctor/ecg/page.tsx
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Link from "next/link";
import { getDoctorSession } from "@/lib/doctorSession";
import ECGInboxClient from "./ECGInboxClient";

const ACCENT = "#44969b";

export default async function DoctorEcgInboxPage() {
  const session = await getDoctorSession();
  if (!session) {
    const nextUrl = encodeURIComponent("/doctor/ecg");
    redirect(`/doctor/login?next=${nextUrl}`);
  }

  const docName =
    session.display_name || (session.credentials ? `${session.name}, ${session.credentials}` : session.name);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Doctor Workflow</p>
          <h1 className="text-2xl font-semibold text-slate-900">ECG Inbox</h1>
          <p className="text-sm text-slate-600 mt-1">
            Browse uploaded ECG strips, complete required interpretations, and link each report to a patient encounter.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">
            Signed in as <b>{docName}</b>
          </div>
          <Link
            href="/doctor"
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 underline decoration-dotted"
          >
            ← Back to Doctor console
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600"
          style={{ backgroundColor: `${ACCENT}08` }}
        >
          Reminder: PhilHealth YAKAP claims require every ECG interpretation to reference the patient encounter used
          during consultation.
        </div>
        <div className="p-4">
          <ECGInboxClient accent={ACCENT} />
        </div>
      </section>
    </div>
  );
}


// app/(doctor)/doctor/ecg/[externalResultId]/page.tsx
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Link from "next/link";
import { getDoctorSession } from "@/lib/doctorSession";
import ReaderClient from "./ReaderClient";

type Props = {
  params: Promise<{ externalResultId: string }>;
};

export default async function ECGReaderPage({ params }: Props) {
  const session = await getDoctorSession();
  if (!session) {
    const { externalResultId } = await params;
    const nextUrl = encodeURIComponent(`/doctor/ecg/${externalResultId}`);
    redirect(`/doctor/login?next=${nextUrl}`);
  }

  const { externalResultId } = await params;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">ECG Interpretation</p>
          <h1 className="text-2xl font-semibold text-slate-900">Reader</h1>
        </div>
        <Link
          href="/doctor/ecg"
          className="text-sm text-slate-600 underline decoration-dotted hover:text-slate-900"
        >
          ← Back to ECG inbox
        </Link>
      </div>

      <ReaderClient externalResultId={externalResultId} />
    </div>
  );
}

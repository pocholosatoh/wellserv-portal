// app/(doctor)/doctor/patient/[patientId]/ConsultQueueModal.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TodayEncounterRow } from "@/lib/todayEncounters";

function TypeBadge({ type }: { type?: string | null }) {
  const isFPE = String(type || "").toUpperCase() === "FPE";
  if (!type) return <>—</>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
        isFPE ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800"
      }`}
      title={isFPE ? "First Patient Encounter" : "Follow-up"}
    >
      {isFPE ? "FPE" : "Follow-up"}
    </span>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const s = String(status || "").toLowerCase();
  const cls =
    s === "done"
      ? "bg-emerald-100 text-emerald-800"
      : s === "in-progress" || s === "in_consult"
      ? "bg-blue-100 text-blue-800"
      : "bg-amber-100 text-amber-800";
  const label =
    s === "done" ? "Done" : s === "in-progress" || s === "in_consult" ? "In progress" : s ? s : "—";
  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{label}</span>;
}

type Props = {
  queue: TodayEncounterRow[];
  branch: "SI" | "SL";
  currentPatientId: string;
};

export default function ConsultQueueModal({ queue, branch, currentPatientId }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const normalizedCurrent = currentPatientId.toUpperCase();
  const nextPatient = useMemo(
    () => queue.find((q) => (q.patient_id || "").toUpperCase() !== normalizedCurrent),
    [queue, normalizedCurrent]
  );

  const handleNext = () => {
    if (!nextPatient) return;
    setOpen(false);
    router.push(`/doctor/patient/${encodeURIComponent(nextPatient.patient_id)}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Consult Queue
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/30"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 mx-auto my-6 w-full max-w-5xl rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs text-gray-500">Consult Queue — {branch}</p>
                <h2 className="text-lg font-semibold text-gray-900">Patients queued for today</h2>
                <p className="text-xs text-gray-500">
                  Open a patient to jump straight into their workspace. This list is updated.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!nextPatient}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={nextPatient ? `Open ${nextPatient.patient_id}` : "No other patients in queue"}
                >
                  Open next patient →
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-lg border border-gray-200 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-gray-50 text-xs font-medium text-gray-700">
                      <th className="py-2 px-3 w-14">#</th>
                      <th className="py-2 px-3">Patient</th>
                      <th className="py-2 px-3">Contact</th>
                      <th className="py-2 px-3">PhilHealth</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {queue.map((r) => (
                      <tr key={r.id} className={r.patient_id.toUpperCase() === normalizedCurrent ? "bg-amber-50" : ""}>
                        <td className="py-2 px-3 font-semibold">{r.queue_number ?? "-"}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900">{r.full_name || r.patient_id}</div>
                          <div className="text-xs text-gray-500">{r.patient_id}</div>
                        </td>
                        <td className="py-2 px-3">{r.contact || "—"}</td>
                        <td className="py-2 px-3">
                          {r.yakap_flag ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                              PhilHealth
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <TypeBadge type={(r as any).consult_type} />
                        </td>
                        <td className="py-2 px-3">
                          <StatusPill status={r.consult_status || r.status} />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Link
                            href={`/doctor/patient/${encodeURIComponent(r.patient_id)}`}
                            className="inline-block rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
                            onClick={() => setOpen(false)}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {queue.length === 0 && (
                      <tr>
                        <td className="py-6 px-3 text-gray-500 text-center" colSpan={7}>
                          No patients in the consult queue yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

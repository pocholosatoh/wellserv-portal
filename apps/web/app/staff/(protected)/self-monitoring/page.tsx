"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtManila } from "@/lib/time";

type ParameterKey = "bp" | "weight" | "glucose";

type StaffSelfMonitoringRow = {
  patient_id: string;
  patient_code: string | null;
  patient_name?: string | null;
  prescribed: ParameterKey[];
  patient_initiated: boolean;
  prescribing_doctor_name: string | null;
  latest_patient_log_at: string | null;
};

const PARAM_LABELS: Record<ParameterKey, string> = {
  bp: "BP",
  weight: "Weight",
  glucose: "Glucose",
};

function PrescribedChips({ items }: { items: ParameterKey[] }) {
  if (!items.length) {
    return <span className="text-gray-500">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((key) => (
        <span
          key={key}
          className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-mono text-gray-700"
        >
          {PARAM_LABELS[key]}
        </span>
      ))}
    </div>
  );
}

function PatientInitiatedTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
      patient-initiated
    </span>
  );
}

export default function StaffSelfMonitoringPage() {
  const [rows, setRows] = useState<StaffSelfMonitoringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/staff/self-monitoring", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load self-monitoring list");
        if (!mounted) return;
        setRows(Array.isArray(json?.rows) ? json.rows : []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load self-monitoring list");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const list = useMemo(() => rows || [], [rows]);
  const empty = !loading && list.length === 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Self-Monitoring</h1>
        {loading && <span className="text-xs text-gray-500">Loading...</span>}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-xl border bg-white p-4 text-center text-gray-500">
            Loading self-monitoring list...
          </div>
        ) : empty ? (
          <div className="rounded-xl border bg-white p-4 text-center text-gray-500">
            No patients are currently prescribed self-monitoring.
          </div>
        ) : (
          list.map((row) => {
            const patientCode = row.patient_code || row.patient_id;
            const latestLabel = row.latest_patient_log_at
              ? fmtManila(row.latest_patient_log_at)
              : "No logs yet";
            const patientHref = row.patient_id
              ? `/staff/portal?patient_id=${encodeURIComponent(row.patient_id)}`
              : null;

            return (
              <article key={row.patient_id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Patient</p>
                    <p className="text-lg font-semibold text-gray-900">{patientCode}</p>
                    {row.patient_name && (
                      <p className="text-xs text-gray-500">{row.patient_name}</p>
                    )}
                    {row.patient_initiated && (
                      <div className="mt-1">
                        <PatientInitiatedTag />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div>
                    <span className="font-medium text-gray-900">Prescribed:</span>
                    <div className="mt-1">
                      <PrescribedChips items={row.prescribed} />
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Prescribing Doctor:</span>{" "}
                    {row.prescribing_doctor_name || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Latest Patient Log:</span>{" "}
                    <span className={row.latest_patient_log_at ? "" : "text-gray-500"}>
                      {latestLabel}
                    </span>
                  </div>
                </div>

                {patientHref && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={patientHref}
                      className="flex-1 min-w-[140px] rounded border px-3 py-1.5 text-center text-sm"
                    >
                      Open patient
                    </Link>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Table */}
      <div className="hidden overflow-auto rounded-xl border bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-medium px-3 py-2">Patient</th>
              <th className="text-left font-medium px-3 py-2">Prescribed</th>
              <th className="text-left font-medium px-3 py-2">Prescribing Doctor</th>
              <th className="text-left font-medium px-3 py-2">Latest Patient Log</th>
              <th className="text-left font-medium px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                  Loading self-monitoring list...
                </td>
              </tr>
            ) : empty ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                  No patients are currently prescribed self-monitoring.
                </td>
              </tr>
            ) : (
              list.map((row) => {
                const patientCode = row.patient_code || row.patient_id;
                const latestLabel = row.latest_patient_log_at
                  ? fmtManila(row.latest_patient_log_at)
                  : "No logs yet";
                const patientHref = row.patient_id
                  ? `/staff/portal?patient_id=${encodeURIComponent(row.patient_id)}`
                  : null;

                return (
                  <tr key={row.patient_id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{patientCode}</div>
                      {row.patient_name && (
                        <div className="text-xs text-gray-500">{row.patient_name}</div>
                      )}
                      {row.patient_initiated && (
                        <div className="mt-1">
                          <PatientInitiatedTag />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <PrescribedChips items={row.prescribed} />
                    </td>
                    <td className="px-3 py-2">{row.prescribing_doctor_name || "-"}</td>
                    <td className="px-3 py-2">
                      <span className={row.latest_patient_log_at ? "" : "text-gray-500"}>
                        {latestLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {patientHref ? (
                        <Link href={patientHref} className="rounded border px-2 py-1 text-sm">
                          Open patient
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

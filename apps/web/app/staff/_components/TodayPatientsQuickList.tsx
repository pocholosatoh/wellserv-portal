"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { resolveScopedBranch } from "@/lib/staffBranchClient";

type Branch = "SI" | "SL";

type TodayPatient = {
  encounter_id: string;
  patient_id: string;
  full_name: string | null;
  queue_number: number | null;
  status: string | null;
  consult_status: string | null;
};

type Props = {
  className?: string;
  targetPath?: string;
  queryParam?: string;
  actionLabel?: string;
  onSelectPatient?: (patientId: string) => void;
};

export function TodayPatientsQuickList({
  className = "",
  targetPath,
  queryParam = "patient",
  actionLabel = "Open record",
  onSelectPatient,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [branch, setBranch] = React.useState<Branch>(() => resolveScopedBranch());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [patients, setPatients] = React.useState<TodayPatient[]>([]);

  const loadPatients = React.useCallback(async (branchCode: Branch) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("view", "quick");
      params.set("branch", branchCode);
      const res = await fetch(`/api/staff/encounters/today?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.error) {
        throw new Error(json?.error || "Failed to load today's patients");
      }
      setPatients((json?.rows as TodayPatient[]) || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load today's patients");
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPatients(branch);
  }, [branch, loadPatients]);

  const handlePick = React.useCallback(
    (patientId: string) => {
      if (onSelectPatient) {
        onSelectPatient(patientId);
        return;
      }
      const params = new URLSearchParams(searchParams?.toString());
      params.set(queryParam, patientId);
      router.push(`${targetPath || pathname}?${params.toString()}`);
    },
    [onSelectPatient, pathname, queryParam, router, searchParams, targetPath],
  );

  return (
    <div className={["rounded-2xl border p-4 space-y-3 bg-white", className].join(" ").trim()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Today’s Patients</h2>
          <p className="text-xs text-neutral-500">
            Filter by branch, then pick a patient to load their record.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={branch}
            onChange={(e) => setBranch(e.target.value as Branch)}
          >
            <option value="SI">San Isidro (SI)</option>
            <option value="SL">San Leonardo (SL)</option>
          </select>
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm text-[#44969b]"
            onClick={() => loadPatients(branch)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 overflow-x-auto pb-1">
        {patients.length === 0 && !loading ? (
          <div className="text-sm text-neutral-500">No patients queued today for this branch.</div>
        ) : (
          patients.map((pat) => (
            <button
              key={pat.encounter_id}
              type="button"
              onClick={() => handlePick(pat.patient_id)}
              className="min-w-[220px] flex-1 rounded-2xl border px-4 py-3 text-left shadow-sm bg-white"
            >
              <div className="text-xs uppercase text-neutral-500 flex items-center gap-2">
                <span className="font-semibold text-[#44969b]">#{pat.queue_number ?? "—"}</span>
                <span>{pat.status || "intake"}</span>
              </div>
              <div className="font-semibold text-sm truncate">
                {pat.full_name || pat.patient_id}
              </div>
              <div className="text-xs text-neutral-500">{pat.patient_id}</div>
              {pat.consult_status && (
                <div className="mt-1 text-[11px] uppercase tracking-wide text-neutral-600">
                  Consult: {pat.consult_status}
                </div>
              )}
              <div className="mt-2 text-center text-xs text-[#44969b] font-medium">
                {actionLabel}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

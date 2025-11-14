"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AccentProps = {
  accent: string;
};

type ReportSummary = {
  id: string;
  encounter_id: string | null;
  doctor_id: string;
  interpreted_at: string | null;
  interpreted_name: string;
  interpreted_license: string | null;
  status: string;
  impression: string;
};

type InboxItem = {
  external_result_id: string;
  patient_id: string;
  encounter_id: string | null;
  taken_at: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  provider: string | null;
  note: string | null;
  url: string;
  content_type: string | null;
  report: ReportSummary | null;
};

type ApiResponse = {
  items: InboxItem[];
  status: "pending" | "completed";
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeContentType(contentType: string | null) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct === "application/pdf" || ct.endsWith("/pdf")) return "pdf";
  return "file";
}

export default function ECGInboxClient({ accent }: AccentProps) {
  const [status, setStatus] = useState<"pending" | "completed">("pending");
  const [patientId, setPatientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("status", status);
    params.set("limit", "50");
    if (patientId.trim()) params.set("pid", patientId.trim().toUpperCase());
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`/api/doctor/ecg/inbox?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const body: ApiResponse | { error?: string } = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message = "error" in body && body.error ? body.error : `HTTP ${res.status}`;
          throw new Error(message);
        }
        if (!abort) {
          setItems(Array.isArray((body as ApiResponse).items) ? (body as ApiResponse).items : []);
        }
      })
      .catch((err: any) => {
        if (!abort) setError(err?.message || "Failed to load ECG inbox");
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });

    return () => {
      abort = true;
    };
  }, [status, patientId, from, to, refreshToken]);

  const emptyText = useMemo(() => {
    if (loading) return "Loading ECG uploads…";
    if (status === "pending") return "No pending ECG interpretations.";
    return "No completed ECG interpretations match your filters.";
  }, [loading, status]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto] items-end">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setStatus("pending")}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium ${
              status === "pending" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setStatus("completed")}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium ${
              status === "completed" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Completed
          </button>
        </div>

        <label className="flex flex-col text-xs font-semibold text-slate-600">
          Patient ID
          <input
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="E.g. SATOH010596"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col text-xs font-semibold text-slate-600">
          Taken from
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col text-xs font-semibold text-slate-600">
          Taken to
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => setRefreshToken((n) => n + 1)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
        >
          Refresh
        </button>
      </div>

      {/* Status */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      )}

      {/* Grid */}
      {items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const kind = normalizeContentType(item.content_type);
            const report = item.report;
            const badge =
              report && report.status === "final"
                ? `Finalized ${fmtDate(report.interpreted_at)}`
                : status === "completed"
                ? "Completed"
                : "Awaiting interpretation";
            const takenLabel = fmtDate(item.taken_at || item.uploaded_at);

            return (
              <div
                key={item.external_result_id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="relative h-44 overflow-hidden rounded-t-xl bg-slate-100">
                  {kind === "image" ? (
                    <img
                      src={item.url}
                      alt={`ECG for ${item.patient_id}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                      {kind === "pdf" ? "PDF document" : "File preview unavailable"}
                    </div>
                  )}
                  <div
                    className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium text-white shadow"
                    style={{ backgroundColor: accent }}
                  >
                    {badge}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.patient_id}</span>
                    <span className="text-xs text-slate-500">
                      Taken {takenLabel}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    {item.provider && (
                      <div>
                        <span className="font-medium text-slate-700">Provider: </span>
                        {item.provider}
                      </div>
                    )}
                    {item.note && (
                      <div className="text-slate-500">
                        <span className="font-medium text-slate-700">Notes: </span>
                        {item.note}
                      </div>
                    )}
                    {report && (
                      <div className="text-slate-600">
                        <span className="font-medium text-slate-700">Impression: </span>
                        {report.impression}
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Encounter: {item.encounter_id ? item.encounter_id.slice(0, 8) + "…" : "—"}
                    </div>
                    <Link
                      href={`/doctor/ecg/${encodeURIComponent(item.external_result_id)}`}
                      className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
                    >
                      Open reader →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type FollowupRow = {
  id: string;
  patient_id: string;
  due_date: string;
  return_branch: string | null;
  intended_outcome?: string | null;
  expected_tests?: string | null;
  status: "scheduled" | "completed" | "canceled" | "skipped";
  created_at?: string | null;
  valid_until?: string | null;
  created_by_name?: string | null;
};

function parseExpectedTokens(raw?: string | null) {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? value
    : dt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? value
    : dt.toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function sortKey(row: FollowupRow) {
  const raw = row.created_at || row.due_date || "";
  const dt = new Date(raw);
  const ts = dt.getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function toTimestamp(value?: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const dt = new Date(value);
  const ts = dt.getTime();
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
}

export default function FollowUpHistoryCard({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<FollowupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const url = `/api/followups/list?start=1900-01-01&end=2100-01-01&patient_id=${encodeURIComponent(patientId)}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.error) throw new Error(json.error || "Failed to load follow-ups");
        if (!abort) setRows(Array.isArray(json.followups) ? json.followups : []);
      } catch (e: any) {
        if (!abort) setErr(e?.message || "Failed to load follow-ups");
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [patientId]);

  const ordered = useMemo(() => {
    return [...rows].sort((a, b) => sortKey(b) - sortKey(a));
  }, [rows]);

  const recent = ordered;

  const latestCreatedAt = useMemo(() => {
    const scheduled = rows.filter((row) => row.status === "scheduled" && row.created_at);
    const source = scheduled.length ? scheduled : rows;
    let latest: string | null = null;
    let latestTs = Number.NEGATIVE_INFINITY;
    source.forEach((row) => {
      const ts = toTimestamp(row.created_at);
      if (ts > latestTs) {
        latestTs = ts;
        latest = row.created_at ?? null;
      }
    });
    return latest;
  }, [rows]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-gray-800">Follow-Up History</h3>
      </div>
      <p className="text-xs text-gray-500">
        Quick reference of prior follow-up requests. Please refer to Past Consultations below for{" "}
        <span className="font-semibold italic">continuity of care</span>. Please schedule a next
        follow-up below.
      </p>
      {rows.length > 0 && (
        <div className="text-xs text-gray-500">
          Latest scheduled input date: {formatDateTime(latestCreatedAt)}
        </div>
      )}

      {loading && <div className="text-sm text-gray-600">Loading follow-ups...</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      {!loading && !err && recent.length === 0 && (
        <div className="text-sm text-gray-600">No follow-ups on record.</div>
      )}

      {recent.length > 0 && (
        <ul className="space-y-3 text-sm">
          {recent.map((row) => {
            const expected = parseExpectedTokens(row.expected_tests);
            return (
              <li key={row.id} className="rounded-lg border border-gray-100 bg-white/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    Due: {formatDateOnly(row.due_date)}
                    {row.return_branch ? <> · {row.return_branch}</> : null}
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">
                    {row.status}
                  </span>
                </div>
                {row.intended_outcome && (
                  <div className="mt-1 text-xs text-gray-700">Intended: {row.intended_outcome}</div>
                )}
                {expected.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {expected.map((tok) => (
                      <span
                        key={tok}
                        className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-mono"
                      >
                        {tok}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  Created: {formatDateTime(row.created_at)}
                  {row.valid_until ? ` · Valid until ${formatDateOnly(row.valid_until)}` : ""}
                </div>
                <div className="text-xs text-gray-500">
                  Prescribed by: {row.created_by_name || "Unknown"}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

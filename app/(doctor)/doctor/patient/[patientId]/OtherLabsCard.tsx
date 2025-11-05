"use client";

import { useEffect, useMemo, useState } from "react";

const ACCENT = "#44969b";

type Item = {
  id: string;
  patient_id: string;
  url: string;                   // already signed by the API
  content_type: string | null;
  type: string;                  // legacy grouping label
  encounter_id?: string | null;
  provider?: string | null;
  taken_at?: string | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  note?: string | null;
  // new Yakap fields
  category?: string | null;
  subtype?: string | null;
  impression?: string | null;
  reported_at?: string | null;
  performer_name?: string | null;
  performer_role?: string | null;
  performer_license?: string | null;
};

type EcgReportSummary = {
  id: string;
  external_result_id: string;
  patient_id: string;
  encounter_id: string | null;
  doctor_id: string;
  interpreted_at: string | null;
  interpreted_name: string;
  interpreted_license: string | null;
  impression: string;
  status: string;
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function isEcgItem(item: Item) {
  const type = String(item.type || "").trim().toUpperCase();
  const category = String(item.category || "").trim().toUpperCase();
  const subtype = String(item.subtype || "").trim().toUpperCase();
  return (
    type === "ECG" ||
    type.startsWith("ECG") ||
    type.includes("ECG") ||
    category === "ECG" ||
    category.startsWith("ECG") ||
    subtype.startsWith("ECG")
  );
}

export default function OtherLabsCard({
  patientId,
  showHeader = true,
}: {
  patientId: string;
  showHeader?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ecgReports, setEcgReports] = useState<Record<string, EcgReportSummary>>({});
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    let abort = false;
    setErr(null);
    setItems(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/patient/other-labs?patient_id=${encodeURIComponent(patientId)}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        if (!abort) setItems(Array.isArray(j) ? j : []);
      } catch (e: any) {
        if (!abort) setErr(e?.message || "Failed to load");
      }
    })();
    return () => {
      abort = true;
    };
  }, [patientId]);

  useEffect(() => {
    if (!items || items.length === 0) {
      setEcgReports({});
      setReportsLoading(false);
      return;
    }

    const ecgIds = items.filter((it) => isEcgItem(it)).map((it) => it.id);

    if (ecgIds.length === 0) {
      setEcgReports({});
      setReportsLoading(false);
      return;
    }

    let abort = false;
    setReportsLoading(true);

    const params = new URLSearchParams();
    params.set("ids", ecgIds.join(","));

    fetch(`/api/ecg/reports?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const body: { reports?: EcgReportSummary[]; error?: string } = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        if (!abort) {
          const map: Record<string, EcgReportSummary> = {};
          (body.reports || []).forEach((rep) => {
            if (rep?.external_result_id) map[rep.external_result_id] = rep;
          });
          setEcgReports(map);
        }
      })
      .catch(() => {
        if (!abort) setEcgReports({});
      })
      .finally(() => {
        if (!abort) setReportsLoading(false);
      });

    return () => {
      abort = true;
    };
  }, [items]);

  const grouped = useMemo(() => {
    const g: Record<string, Item[]> = {};
    (items || []).forEach((it) => {
      const key = (it.type || "Uncategorized").trim();
      (g[key] ||= []).push(it);
    });
    Object.keys(g).forEach((k) => {
      g[k].sort(
        (a, b) =>
          new Date(b.taken_at || b.uploaded_at || 0).getTime() -
          new Date(a.taken_at || a.uploaded_at || 0).getTime()
      );
    });
    return g;
  }, [items]);

  const groups = Object.keys(grouped);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <h3 className="font-semibold text-gray-800">Other Labs</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      )}

      {open && (
        <div className={showHeader ? "px-4 pb-4" : "px-4 pt-4 pb-4"}>
          {/* status + errors */}
          {!items && !err && (
            <div className="text-sm text-gray-500">Loading external results…</div>
          )}
          {err && <div className="text-sm text-red-600">Failed to load: {err}</div>}
          {items && items.length === 0 && (
            <div className="text-sm text-gray-500">No outside lab results uploaded.</div>
          )}

          {/* content */}
          {items && items.length > 0 && (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group} className="rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="font-medium text-gray-800">{group}</div>
                    <div className="text-xs text-gray-500">
                      {grouped[group].length} file{grouped[group].length > 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:grid-cols-3">
                    {grouped[group].map((it) => {
                      const isEcg = isEcgItem(it);
                      const report = isEcg ? ecgReports[it.id] : undefined;
                      const isImg = (it.content_type || "").startsWith("image/");
                      const isPdf =
                        it.content_type === "application/pdf" ||
                        it.url.toLowerCase().includes(".pdf");

                      return (
                        <div
                          key={it.id}
                          className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                        >
                          {/* header row: chips */}
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            {it.category && (
                              <span
                                className="rounded-full border px-2 py-0.5 text-xs"
                                style={{
                                  borderColor: ACCENT + "66",
                                  color: ACCENT,
                                  background: ACCENT + "14",
                                }}
                              >
                                {it.category}
                              </span>
                            )}
                            {it.subtype && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                                {it.subtype}
                              </span>
                            )}
                            {it.provider && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                                {it.provider}
                              </span>
                            )}
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                              {fmtDate(it.taken_at)}
                            </span>
                          </div>

                          {/* preview */}
                          <div className="mb-2">
                            {isImg ? (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-md border"
                                title="Open image"
                              >
                                <img
                                  src={it.url}
                                  alt={it.note || it.subtype || it.type}
                                  className="aspect-[4/3] w-full object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ) : isPdf ? (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 rounded-md border p-3 hover:bg-gray-50"
                                title="Open PDF"
                              >
                                <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="h-5 w-5 text-gray-600"
                                  >
                                    <path
                                      d="M6 2h7l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-800">
                                    Open PDF
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {fmtDate(it.taken_at)}
                                  </div>
                                </div>
                              </a>
                            ) : (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-md border p-3 hover:bg-gray-50"
                              >
                                <div className="text-sm font-medium text-gray-800">
                                  Open file
                                </div>
                                <div className="text-xs text-gray-500">
                                  {it.content_type || "file"} • {fmtDate(it.taken_at)}
                                </div>
                              </a>
                            )}
                          </div>

                          {/* meta */}
                          <div className="space-y-1.5 text-xs text-gray-600">
                            {it.impression && (
                              <div>
                                <span className="font-medium text-gray-800">Impression: </span>
                                <span className="whitespace-pre-wrap">{it.impression}</span>
                              </div>
                            )}
                            {it.reported_at && (
                              <div>
                                <span className="font-medium text-gray-800">Reported: </span>
                                {fmtDate(it.reported_at)}
                              </div>
                            )}
                            {(it.performer_name || it.performer_role || it.performer_license) && (
                              <div className="text-gray-700">
                                <span className="font-medium text-gray-800">Performer: </span>
                                {it.performer_name || "—"}
                                {it.performer_role ? ` • ${it.performer_role}` : ""}
                                {it.performer_license ? ` • PRC ${it.performer_license}` : ""}
                              </div>
                            )}
                            {it.note && (
                              <div>
                                <span className="font-medium text-gray-800">Notes: </span>
                                <span className="whitespace-pre-wrap">{it.note}</span>
                              </div>
                            )}
                            {isEcg && (
                              <div>
                                <span className="font-medium text-gray-800">ECG Status: </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    report?.status === "final"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {report?.status === "final"
                                    ? `Interpreted ${fmtDate(report.interpreted_at)}`
                                    : reportsLoading
                                    ? "Fetching interpretation…"
                                    : "Awaiting interpretation"}
                                </span>
                                {report?.interpreted_name && (
                                  <div className="mt-1 text-xs text-gray-600">
                                    by {report.interpreted_name}
                                    {report.interpreted_license ? ` • PRC ${report.interpreted_license}` : ""}
                                  </div>
                                )}
                                {!report && !reportsLoading && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    Doctor interpretation pending.
                                  </div>
                                )}
                                {report?.impression && (
                                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2 text-[12px] text-emerald-900 whitespace-pre-wrap">
                                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">
                                      Interpretation
                                    </span>
                                    {report.impression}
                                    {report.recommendations && (
                                      <div className="mt-1 text-emerald-800">
                                        <span className="font-medium">Recommendations:</span>{" "}
                                        {report.recommendations}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

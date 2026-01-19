"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fmtManila } from "@/lib/time";

type DoctorLite = {
  display_name?: string | null;
  full_name?: string | null;
  credentials?: string | null;
};

type Consult = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_at: string;
  plan_shared: boolean | null;
  doctor_name_at_time?: string | null;
  doctor?: DoctorLite | null;
};

type ConsultDetails = {
  id: string;
  patient_id: string;
  visit_at: string;
  plan_shared: boolean | null;
  doctor?: DoctorLite | null;
  doctor_name_at_time?: string | null;
  signing_doctor_name?: string | null;
  notes?: {
    notes_markdown?: string | null;
    notes_soap?: any | null;
  } | null;
  rx?: {
    id: string;
    status: string | null;
    notes_for_patient?: string | null;
    valid_days?: number | null;
    valid_until?: string | null;
    items: Array<{
      generic_name: string | null;
      brand_name: string | null;
      strength: string | null;
      form: string | null;
      quantity: number | null;
      unit_price: number | null;
    }>;
  } | null;
};

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

type Props = {
  patientId: string;
  consultations: Consult[];
  latestConsultationDetails: ConsultDetails | null;
  followups: FollowupRow[];
  selfMonitoringPrescribed: boolean | null;
  patientHeading?: {
    fullName: string | null;
    age: number | null;
    sex: string | null;
  };
};

const REPORT_COUNT_EVENT = "reportviewer:loaded";

function docName(c: {
  doctor?: DoctorLite | null;
  doctor_name_at_time?: string | null;
  signing_doctor_name?: string | null;
}) {
  const d = c.doctor;
  const cred = (d?.credentials || "").trim();
  const hasCred = !!cred;

  if (d?.full_name) {
    return hasCred ? `${d.full_name}, ${cred}` : d.full_name;
  }
  if (d?.display_name) {
    if (hasCred && !new RegExp(`,\\s*${cred}$`).test(d.display_name)) {
      return `${d.display_name}, ${cred}`;
    }
    return d.display_name;
  }
  if (c.signing_doctor_name) return c.signing_doctor_name;
  if (c.doctor_name_at_time) return c.doctor_name_at_time;
  return "Attending Doctor";
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

function parseExpectedTokens(raw?: string | null) {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function Card({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border border-gray-200 bg-white/95 shadow-sm ${className}`}
    >
      <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm text-gray-700">{children}</div>
    </div>
  );
}

function SkeletonLines({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-3 w-full rounded bg-gray-200" />
      ))}
    </div>
  );
}

export default function ContinuityOfCareModal({
  patientId,
  consultations,
  latestConsultationDetails,
  followups,
  selfMonitoringPrescribed,
  patientHeading,
}: Props) {
  const [open, setOpen] = useState(true);
  const [labCount, setLabCount] = useState<number | null>(null);

  useEffect(() => {
    setOpen(true);
    setLabCount(null);
  }, [patientId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const eventPid = String(detail.patientId || "").toUpperCase();
      if (eventPid && eventPid !== patientId.toUpperCase()) return;
      const count = Number(detail.count);
      if (Number.isFinite(count)) setLabCount(count);
    };
    window.addEventListener(REPORT_COUNT_EVENT, handler as EventListener);
    return () => window.removeEventListener(REPORT_COUNT_EVENT, handler as EventListener);
  }, [patientId]);

  const latestConsult = consultations?.[0] ?? null;
  const latestFollowup = useMemo(() => {
    if (!followups || followups.length === 0) return null;
    return [...followups].sort((a, b) => sortKey(b) - sortKey(a))[0] ?? null;
  }, [followups]);

  const soap = useMemo(() => {
    const raw = latestConsultationDetails?.notes?.notes_soap;
    if (!raw || typeof raw !== "object") return {};
    return raw as Record<string, string>;
  }, [latestConsultationDetails]);

  const soapHasContent = ["S", "O", "A", "P"].some((k) => (soap?.[k] || "").trim());
  const md = (latestConsultationDetails?.notes?.notes_markdown || "").trim();
  const expectedTests = parseExpectedTokens(latestFollowup?.expected_tests);
  const headingName = patientHeading?.fullName || patientId;
  const headingAge = patientHeading?.age != null ? `${patientHeading.age}` : "-";
  const headingSex = patientHeading?.sex || "-";
  const headingLine = `${headingName} · ${headingAge}/${headingSex}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Continuity of Care
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 py-6 sm:items-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-[980px] max-h-[80vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Continuity of Care Panel</h2>
                <div className="text-left sm:text-right">
                  <div className="text-lg sm:text-xl font-semibold text-gray-900">
                    {headingLine}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card
                  title="Patient's Latest Doctor Notes"
                  className="md:col-span-3 h-[220px] sm:h-[240px]"
                >
                  {!latestConsult ? (
                    <p className="text-sm text-gray-500">No prior consultations available.</p>
                  ) : !latestConsultationDetails ? (
                    <SkeletonLines rows={5} />
                  ) : (
                    <div className="space-y-3 text-xs text-gray-700">
                      <div className="text-[11px] text-gray-500">
                        {fmtManila(latestConsultationDetails.visit_at || latestConsult.visit_at)} -
                        Consulting MD:{" "}
                        <span className="font-semibold">
                          {docName(latestConsultationDetails)}
                        </span>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">
                          Doctor Notes
                        </div>
                        {!md && !soapHasContent && (
                          <p className="text-sm text-gray-500">No notes.</p>
                        )}
                        <div className="space-y-2 text-sm">
                          {soapHasContent && (
                            <div className="space-y-1">
                              {(["S", "O", "A", "P"] as const).map((k) => {
                                const val = (soap?.[k] || "").trim();
                                if (!val) return null;
                                return (
                                  <div key={k}>
                                    <span className="font-semibold">{k}:</span> {val}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {md && (
                            <pre className="whitespace-pre-wrap text-sm text-gray-700">{md}</pre>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold">Prescription:</span>{" "}
                          {!latestConsultationDetails.rx ? (
                            <span className="text-gray-500">No prescription.</span>
                          ) : latestConsultationDetails.rx.items.length === 0 ? (
                            <span className="text-gray-600">Prescription on file.</span>
                          ) : (
                            <div className="mt-1 space-y-1">
                              {latestConsultationDetails.rx.items.map((it, i) => (
                                <div key={i}>
                                  {it.generic_name}
                                  {it.brand_name ? (
                                    <>
                                      {" "}
                                      (<i>{it.brand_name}</i>)
                                    </>
                                  ) : null}
                                  {" - "} {it.strength} {it.form}
                                  {it.quantity != null && (
                                    <span className="text-gray-600"> (Qty {it.quantity})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {latestConsultationDetails.rx?.notes_for_patient && (
                          <div>
                            <span className="font-semibold">Instructions:</span>{" "}
                            {latestConsultationDetails.rx.notes_for_patient}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="Latest Follow-up Notes" className="md:col-span-2 h-[170px]">
                  {!latestFollowup ? (
                    <p className="text-sm text-gray-500">No follow-ups recorded.</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Due: {formatDateOnly(latestFollowup.due_date)}</span>
                        <span className="uppercase">{latestFollowup.status}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Intended outcome:</span>{" "}
                        {latestFollowup.intended_outcome || "-"}
                      </div>
                      <div>
                        <span className="font-semibold">Tests requested:</span>{" "}
                        {expectedTests.length ? expectedTests.join(", ") : "-"}
                      </div>
                      <div>
                        <span className="font-semibold">Created:</span>{" "}
                        {formatDateTime(latestFollowup.created_at)}
                      </div>
                      <div>
                        <span className="font-semibold">Prescribing doctor:</span>{" "}
                        {latestFollowup.created_by_name || "-"}
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="Status / Metrics" className="md:col-span-1 h-[170px]">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span># of Visits / Lab Tests</span>
                      <span className="font-semibold text-gray-800">
                        {labCount == null ? (
                          <span className="text-gray-400">Loading...</span>
                        ) : (
                          labCount
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span># of Past Consults</span>
                      <span className="font-semibold text-gray-800">
                        {Array.isArray(consultations) ? consultations.length : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Self-Monitoring Prescribed</span>
                      <span className="font-semibold text-gray-800">
                        {selfMonitoringPrescribed == null
                          ? "-"
                          : selfMonitoringPrescribed
                            ? "Yes"
                            : "No"}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-sm text-gray-600 max-w-[520px]">
                  <span className="font-semibold text-gray-700">From management:</span> Please
                  schedule a follow-up as necessary through the calendar in the workspace. Kindly
                  indicate intention and requested tests. Thank you.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-[#44969b] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Acknowledged
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

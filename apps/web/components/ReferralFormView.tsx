"use client";

import { useMemo } from "react";
import PatientHistoryView, { type PatientHistoryData } from "@/components/PatientHistoryView";
import VitalsSnapshotView, { type VitalsSnapshotViewData } from "@/components/VitalsSnapshotView";
import { formatPrcNo } from "@/lib/formatPrcNo";

export type ReferralFormData = {
  referral: {
    id: string;
    referral_code: string | null;
    created_at: string | null;
    include_latest_notes: boolean;
    include_latest_labs: boolean;
    include_latest_vitals: boolean;
    include_patient_history: boolean;
    notes?: string | null;
    snapshot_affiliation_text?: string | null;
  };
  patient: {
    patient_id: string;
    full_name: string | null;
    birthday: string | null;
    age: number | null;
    sex: string | null;
    address: string | null;
  } | null;
  referredBy: {
    full_name: string | null;
    credentials: string | null;
    prc_no: string | null;
  } | null;
  referredTo: {
    full_name: string | null;
    credentials: string | null;
    prc_no: string | null;
  } | null;
  affiliations: {
    snapshot_text: string;
  }[];
  specialty: {
    name: string | null;
    code: string | null;
  } | null;
  latestNotes: {
    consultation_id: string;
    visit_at: string | null;
    notes_markdown: string | null;
    notes_soap: Record<string, any> | null;
  } | null;
  latestLabs: {
    report: Record<string, any>;
    patientOnly?: boolean;
  } | null;
  patientHistory: PatientHistoryData | null;
  vitalsSnapshots: VitalsSnapshotViewData[] | null;
};

const DISPLAY_TZ = "Asia/Manila";

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(dt);
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDoctorName(fullName?: string | null, credentials?: string | null) {
  const base = String(fullName || "").trim();
  const cred = String(credentials || "").trim();
  if (!base) return "-";
  if (cred && !new RegExp(`,\\s*${escapeRegExp(cred)}$`).test(base)) {
    return `${base}, ${cred}`;
  }
  return base;
}

export default function ReferralFormView({
  data,
  className = "",
}: {
  data: ReferralFormData;
  className?: string;
}) {
  const patient = data.patient;
  const referredBy = data.referredBy;
  const referredTo = data.referredTo;
  const specialty = data.specialty;
  const affiliations = data.affiliations || [];
  const notes = data.latestNotes;
  const labs = data.latestLabs;
  const vitalsSnapshots = data.vitalsSnapshots;
  const patientHistory = data.patientHistory;
  const includePatientHistory = data.referral.include_patient_history;
  const referredToPrc = formatPrcNo(referredTo?.prc_no);
  const referredByPrc = formatPrcNo(referredBy?.prc_no);

  const labSections = useMemo(() => {
    const report = labs?.report || null;
    if (!report) return [] as Array<{ name: string; items: any[] }>;
    return Array.isArray(report.sections) ? report.sections : [];
  }, [labs]);

  const soapSections = useMemo(() => {
    const soap = notes?.notes_soap || null;
    if (!soap || typeof soap !== "object") return [] as Array<{ key: string; value: string }>;
    return ["S", "O", "A", "P"]
      .map((key) => ({ key, value: String((soap as any)[key] || "").trim() }))
      .filter((entry) => entry.value);
  }, [notes]);

  return (
    <div className={`referral-form text-gray-900 ${className}`}>
      <header className="referral-letterhead border-b border-slate-200 pb-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="/wellserv-logo.png" alt="Wellserv" className="h-12 w-auto" />
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Referral Code</div>
            <div className="text-sm font-semibold">
              {data.referral.referral_code || data.referral.id}
            </div>
            <div className="text-xs text-slate-500">{formatDate(data.referral.created_at)}</div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4">
        <div className="avoid-page-break rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500 mb-2">
            Patient Information
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-500">Name:</span>{" "}
              <span className="font-medium">{patient?.full_name || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500">Patient ID:</span>{" "}
              <span className="font-medium">{patient?.patient_id || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500">Age/Sex:</span>{" "}
              <span className="font-medium">
                {patient?.age != null ? `${patient.age}` : "-"}
                {patient?.sex ? ` / ${patient.sex}` : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Birthday:</span>{" "}
              <span className="font-medium">{formatDate(patient?.birthday)}</span>
            </div>
            {patient?.address ? (
              <div className="sm:col-span-2">
                <span className="text-slate-500">Address:</span>{" "}
                <span className="font-medium">{patient.address}</span>
              </div>
            ) : null}
          </div>
        </div>

        {includePatientHistory && (
          <div className="avoid-page-break rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500 mb-2">
              Patient History
            </div>
            <PatientHistoryView history={patientHistory} />
          </div>
        )}

        <div className="avoid-page-break rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Referred To</div>
          <div className="text-sm space-y-1">
            <div className="font-medium">
              {formatDoctorName(referredTo?.full_name, referredTo?.credentials)}
            </div>
            {specialty?.name || specialty?.code ? (
              <div className="text-slate-600">{specialty?.name || specialty?.code}</div>
            ) : null}
            {referredToPrc ? (
              <div className="text-slate-600">PRC No.: {referredToPrc}</div>
            ) : null}
            {affiliations.length > 0 ? (
              <div className="mt-2 space-y-2">
                {affiliations.map((aff, idx) => (
                  <pre
                    key={`${aff.snapshot_text.slice(0, 24)}-${idx}`}
                    className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs whitespace-pre-wrap"
                  >
                    {aff.snapshot_text}
                  </pre>
                ))}
              </div>
            ) : data.referral.snapshot_affiliation_text ? (
              <pre className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs whitespace-pre-wrap">
                {data.referral.snapshot_affiliation_text}
              </pre>
            ) : (
              <div className="text-xs text-slate-400">No affiliation details provided.</div>
            )}
          </div>
        </div>

        <div className="avoid-page-break rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Referred By</div>
          <div className="text-sm space-y-1">
            <div className="font-medium">
              {formatDoctorName(referredBy?.full_name, referredBy?.credentials)}
            </div>
            {referredByPrc ? (
              <div className="text-slate-600">PRC No.: {referredByPrc}</div>
            ) : null}
          </div>
        </div>

        {data.referral.notes ? (
          <div className="avoid-page-break rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Remarks</div>
            <div className="text-sm whitespace-pre-wrap text-slate-700">{data.referral.notes}</div>
          </div>
        ) : null}

        {data.referral.include_latest_notes && (
          <div className="avoid-page-break rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500 mb-2">
              Latest Consult Notes
            </div>
            <div className="text-xs text-slate-400 mb-2">
              Completed consult from {formatDateTime(notes?.visit_at)}
            </div>
            {!notes || (!notes.notes_markdown && (!notes.notes_soap || soapSections.length === 0)) ? (
              <div className="text-sm text-slate-500">No notes available.</div>
            ) : (
              <div className="space-y-3 text-sm">
                {notes.notes_markdown ? (
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-500">Markdown</div>
                    <pre className="whitespace-pre-wrap text-sm text-slate-700">
                      {notes.notes_markdown}
                    </pre>
                  </div>
                ) : null}
                {soapSections.length > 0 ? (
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-500">SOAP</div>
                    <div className="space-y-1">
                      {soapSections.map((entry) => (
                        <div key={entry.key}>
                          <b>{entry.key}:</b> {entry.value}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {data.referral.include_latest_labs && (
          <div className="avoid-page-break rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500 mb-2">
              Latest Lab Results
            </div>
            <div className="text-xs text-slate-400 mb-2">
              {formatDate(labs?.report?.visit?.date_of_test)}
            </div>
            {labSections.length === 0 ? (
              <div className="text-sm text-slate-500">No lab data available.</div>
            ) : (
              <div className="space-y-3">
                {labSections.map((section) => (
                  <div key={section.name} className="border border-slate-100 rounded-md p-2">
                    <div className="text-xs font-semibold uppercase text-slate-500 mb-2">
                      {section.name}
                    </div>
                    <div className="space-y-1 text-sm">
                      {(section.items || []).map((item: any) => (
                        <div key={`${section.name}-${item.key}`} className="flex justify-between gap-4">
                          <span className="text-slate-700">
                            {item.label || item.key || "Item"}
                          </span>
                          <span className="text-slate-800">
                            {item.value}
                            {item.unit ? ` ${item.unit}` : ""}
                            {item.flag ? ` (${item.flag})` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {data.referral.include_latest_vitals && (
          <div className="avoid-page-break">
            <VitalsSnapshotView snapshots={vitalsSnapshots} />
          </div>
        )}
      </section>

      <footer className="mt-4 text-xs text-slate-500 flex items-center justify-between">
        <span>Generated on {formatDateTime(data.referral.created_at)}</span>
        <span>WELLSERV Medical Corporation</span>
      </footer>
    </div>
  );
}

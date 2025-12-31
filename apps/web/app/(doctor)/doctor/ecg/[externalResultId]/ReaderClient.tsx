"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ReaderProps = {
  externalResultId: string;
};

type Strip = {
  external_result_id: string;
  patient_id: string;
  encounter_id: string | null;
  taken_at: string | null;
  uploaded_at: string | null;
  provider: string | null;
  note: string | null;
  url: string;
  content_type: string | null;
};

type Encounter = {
  id: string;
  patient_id: string;
  created_at: string | null;
  reason: string | null;
  branch: string | null;
};

type Report = {
  id: string;
  encounter_id: string | null;
  doctor_id: string;
  interpreted_at: string | null;
  interpreted_name: string;
  interpreted_license: string | null;
  status: string;
  rhythm: string | null;
  heart_rate: string | null;
  pr_interval: string | null;
  qrs_duration: string | null;
  qtc: string | null;
  axis: string | null;
  findings: string | null;
  impression: string;
  recommendations: string | null;
};

type FetchResponse = {
  strip: Strip;
  report: Report | null;
  encounters: Encounter[];
};

type InterpretPayload = {
  encounter_id: string;
  external_result_id: string;
  impression: string;
  rhythm?: string | null;
  heart_rate?: string | null;
  pr_interval?: string | null;
  qrs_duration?: string | null;
  qtc?: string | null;
  axis?: string | null;
  findings?: string | null;
  recommendations?: string | null;
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

export default function ReaderClient({ externalResultId }: ReaderProps) {
  const [strip, setStrip] = useState<Strip | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [encounterId, setEncounterId] = useState("");
  const [rhythm, setRhythm] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [prInterval, setPrInterval] = useState("");
  const [qrsDuration, setQrsDuration] = useState("");
  const [qtc, setQtc] = useState("");
  const [axis, setAxis] = useState("");
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const viewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);

    fetch(`/api/doctor/ecg/${externalResultId}`, { cache: "no-store" })
      .then(async (res) => {
        const body: FetchResponse | { error?: string } = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message = "error" in body && body.error ? body.error : `HTTP ${res.status}`;
          throw new Error(message);
        }
        if (!abort) {
          const payload = body as FetchResponse;
          setStrip(payload.strip);
          setZoom(1);
          setOffset({ x: 0, y: 0 });
          setReport(payload.report);
          setEncounters(Array.isArray(payload.encounters) ? payload.encounters : []);
          if (payload.report) {
            setEncounterId(payload.report.encounter_id || "");
            setRhythm(payload.report.rhythm || "");
            setHeartRate(payload.report.heart_rate || "");
            setPrInterval(payload.report.pr_interval || "");
            setQrsDuration(payload.report.qrs_duration || "");
            setQtc(payload.report.qtc || "");
            setAxis(payload.report.axis || "");
            setFindings(payload.report.findings || "");
            setImpression(payload.report.impression || "");
            setRecommendations(payload.report.recommendations || "");
          } else {
            const initialEncounter =
              payload.strip.encounter_id || payload.encounters?.[0]?.id || "";
            setEncounterId(initialEncounter);
          }
        }
      })
      .catch((err: any) => {
        if (!abort) setError(err?.message || "Failed to load ECG strip");
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });

    return () => {
      abort = true;
    };
  }, [externalResultId]);

  const kind = useMemo(
    () => normalizeContentType(strip?.content_type || null),
    [strip?.content_type],
  );
  const readonly = !!report;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readonly) return;
    if (!strip) return;

    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    try {
      const payload: InterpretPayload = {
        external_result_id: strip.external_result_id,
        encounter_id: encounterId.trim(),
        impression: impression.trim(),
        rhythm: rhythm.trim() || null,
        heart_rate: heartRate.trim() || null,
        pr_interval: prInterval.trim() || null,
        qrs_duration: qrsDuration.trim() || null,
        qtc: qtc.trim() || null,
        axis: axis.trim() || null,
        findings: findings.trim() || null,
        recommendations: recommendations.trim() || null,
      };

      if (!payload.encounter_id) {
        throw new Error("Encounter is required for PhilHealth YAKAP compliance.");
      }
      if (!payload.impression) {
        throw new Error("Impression is required.");
      }

      const res = await fetch("/api/doctor/ecg/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: { ok?: boolean; report?: Report; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !body.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setReport(body.report || null);
      setSubmitSuccess("Interpretation saved successfully.");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to finalize interpretation.");
    } finally {
      setSubmitting(false);
    }
  }

  const encounterOptions = useMemo(() => {
    return encounters.map((enc) => ({
      id: enc.id,
      label: `${fmtDate(enc.created_at)} • ${enc.reason || "Encounter"}${enc.branch ? ` • ${enc.branch}` : ""}`,
    }));
  }, [encounters]);

  function clampZoom(value: number) {
    return Math.min(6, Math.max(0.25, value));
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!viewerRef.current) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => clampZoom(prev + delta));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    target.classList.add("cursor-grabbing");
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    e.preventDefault();
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.currentTarget;
    dragRef.current = { active: false, x: 0, y: 0 };
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    target.classList.remove("cursor-grabbing");
  }

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        Loading ECG strip…
      </div>
    );
  }

  if (error || !strip) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        {error || "ECG strip not found."}
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_340px] xl:grid-cols-[minmax(0,2.6fr)_360px]">
      {/* Left: Viewer */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Patient {strip.patient_id}</h2>
              <p className="text-xs text-slate-500">
                Taken {fmtDate(strip.taken_at || strip.uploaded_at)} • Provider{" "}
                {strip.provider || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
              >
                Zoom -
              </button>
              <div className="min-w-[70px] rounded-lg border border-slate-200 px-3 py-1 text-center text-xs text-slate-600">
                {Math.round(zoom * 100)}%
              </div>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
              >
                Zoom +
              </button>
              <button
                type="button"
                onClick={resetView}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
              >
                Reset
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 pb-4">
          <div
            ref={viewerRef}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={(e) => {
              if (dragRef.current.active) handlePointerUp(e);
            }}
            className="relative h-[55vh] min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-slate-100 to-white cursor-grab"
            style={{ touchAction: "none" }}
          >
            {kind === "image" ? (
              <div className="flex h-full w-full items-center justify-center">
                <img
                  src={strip.url}
                  alt={`ECG strip for ${strip.patient_id}`}
                  className="select-none"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                    width: "auto",
                    height: "auto",
                    maxWidth: "unset",
                    maxHeight: "unset",
                  }}
                  draggable={false}
                />
              </div>
            ) : kind === "pdf" ? (
              <iframe src={strip.url} title="ECG PDF" className="h-full w-full rounded-xl" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Preview unavailable.{" "}
                <a href={strip.url} target="_blank" rel="noreferrer" className="ml-1 underline">
                  Open file
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Right: Interpretation form */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            {readonly ? "Final Interpretation" : "Interpretation Form"}
          </h2>
          <p className="text-xs text-slate-500">
            Encounter link is mandatory for PhilHealth YAKAP. Impression is required before
            finalizing.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 py-4">
          {submitSuccess && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {submitSuccess}
            </div>
          )}
          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Encounter *
            <select
              value={encounterId}
              onChange={(e) => setEncounterId(e.target.value)}
              disabled={readonly || submitting || encounters.length === 0}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            >
              <option value="">Select encounter</option>
              {encounterOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            {encounters.length === 0 && (
              <span className="text-xs font-normal text-red-600">
                No encounters found for this patient. Create/assign an encounter first.
              </span>
            )}
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Rhythm
              <input
                value={rhythm}
                onChange={(e) => setRhythm(e.target.value)}
                disabled={readonly || submitting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Heart rate
              <input
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                disabled={readonly || submitting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              PR interval
              <input
                value={prInterval}
                onChange={(e) => setPrInterval(e.target.value)}
                disabled={readonly || submitting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              QRS duration
              <input
                value={qrsDuration}
                onChange={(e) => setQrsDuration(e.target.value)}
                disabled={readonly || submitting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              QTc
              <input
                value={qtc}
                onChange={(e) => setQtc(e.target.value)}
                disabled={readonly || submitting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Axis
              <input
                value={axis}
                onChange={(e) => setAxis(e.target.value)}
                disabled={readonly || submitting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Findings
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              disabled={readonly || submitting}
              rows={3}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Impression *
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              disabled={readonly || submitting}
              rows={3}
              className={`rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                readonly
                  ? "border-slate-200 bg-slate-100 text-slate-600"
                  : "border-slate-200 focus:border-slate-400"
              }`}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Recommendations
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              disabled={readonly || submitting}
              rows={3}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            />
          </label>

          {report && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-700">Finalized interpretation</div>
              <div className="mt-1">
                <span className="font-medium text-slate-700">Interpreted by: </span>
                {report.interpreted_name}
                {report.interpreted_license ? ` • PRC ${report.interpreted_license}` : ""}
              </div>
              <div>
                <span className="font-medium text-slate-700">Encounter: </span>
                {report.encounter_id || "—"}
              </div>
              <div>
                <span className="font-medium text-slate-700">Finalized: </span>
                {fmtDate(report.interpreted_at)}
              </div>
            </div>
          )}

          {!readonly && (
            <button
              type="submit"
              disabled={submitting || !encounterId || !impression.trim()}
              className="mt-2 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? "Saving…" : "Finalize interpretation"}
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

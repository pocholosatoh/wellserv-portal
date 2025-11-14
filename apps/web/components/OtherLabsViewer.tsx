"use client";

// app/components/OtherLabsViewer.tsx
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";


// If you used an enum in DB later, you can tighten this union.
// For now keep it string to work with text column or backfilled rows.
export type OtherLabType =
  | "Lab Tests (3rd Party)"
  | "Imaging Reports (X-ray, Ultrasound, etc.)"
  | "Other"
  | (string & {});

export type OtherLabItem = {
  id: string;
  patient_id: string;
  url: string;
  content_type: string;
  type: OtherLabType;              // required in UI
  category?: string | null;
  subtype?: string | null;
  encounter_id?: string | null;
  provider?: string | null;
  taken_at?: string | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  note?: string | null;
  impression?: string | null;
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
  recommendations?: string | null;
  status: string;
};

function isEcgItem(item: { type?: string | null; category?: string | null; subtype?: string | null }) {
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

export type OtherLabsViewerProps = {
  /** If omitted, component fetches via session (/api/patient/other-labs) */
  patientId?: string;
  /** Force session mode even if patientId is provided (rare) */
  useSession?: boolean;
  apiPath?: string;
  title?: string;
  className?: string;
  showIfEmpty?: boolean;
  initiallyCollapsed?: boolean;
  emptyText?: string;
};

function fmtDate(d?: string | null) {
  if (!d) return "Unknown date";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}
function fileNameFromUrl(url: string) {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split("/").pop() || url);
  } catch {
    return url;
  }
}

/** Render children into document.body to escape any parent overflow/stacking */
function BodyPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/** Full-screen image lightbox with zoom/pan */
function ImageLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const [scale, setScale] = React.useState(0.4);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);
  const dragging = React.useRef(false);
  const last = React.useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+") setScale((s) => Math.min(6, s + 0.25));
      if (e.key === "-") setScale((s) => Math.max(0.25, s - 0.25));
      if (e.key === "0") { setScale(1); setTx(0); setTy(0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setScale((s) => Math.min(6, Math.max(0.25, s + delta)));
  }
  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setTx((v) => v + dx);
    setTy((v) => v + dy);
  }
  function onPointerUp(e: React.PointerEvent) {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[9999] bg-black/90" onClick={onClose}>
        <div className="absolute left-1/2 -translate-x-1/2 top-3 flex gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow">
          <button className="text-sm px-2" onClick={(e)=>{e.stopPropagation(); setScale(s=>Math.max(0.25,s-0.25));}}>-</button>
          <div className="text-xs px-2">{Math.round(scale*100)}%</div>
          <button className="text-sm px-2" onClick={(e)=>{e.stopPropagation(); setScale(s=>Math.min(6,s+0.25));}}>+</button>
          <button className="text-sm px-2" onClick={(e)=>{e.stopPropagation(); setScale(1); setTx(0); setTy(0);}}>Fit</button>
          <a href={src} target="_blank" rel="noreferrer" className="text-sm px-2 underline" onClick={(e)=>e.stopPropagation()}>Open original</a>
        </div>
        <button onClick={(e)=>{e.stopPropagation(); onClose();}} className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-white text-gray-900 shadow">
          Close
        </button>
        <div
          className="w-full h-full flex items-center justify-center overflow-hidden"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            src={src}
            alt={alt}
            className="touch-none select-none will-change-transform"
            style={{ transform:`translate(${tx}px,${ty}px) scale(${scale})`, transformOrigin:"center center", maxWidth:"none", maxHeight:"none" }}
            onClick={(e)=>e.stopPropagation()}
            draggable={false}
          />
        </div>
      </div>
    </BodyPortal>
  );
}

/** Full-screen PDF overlay (browser renderer) */
function PdfLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[9999] bg-black/90">
        <div className="absolute left-1/2 -translate-x-1/2 top-3 flex gap-3 rounded-full bg-white/95 px-3 py-1.5 shadow">
          <a href={src} target="_blank" rel="noreferrer" className="text-sm underline">Open original</a>
          <a href={src} download className="text-sm underline">Download</a>
        </div>
        <button onClick={onClose} className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-white text-gray-900 shadow">Close</button>
        <iframe src={src} className="w-full h-full" title="PDF Preview" />
      </div>
    </BodyPortal>
  );
}

export default function OtherLabsViewer(props: OtherLabsViewerProps) {
  const {
    patientId,
    useSession = !patientId,             // default to session mode when no patientId is passed
    apiPath = "/api/patient/other-labs-v2",
    title = "Other Labs",
    className = "",
    showIfEmpty = false,
    initiallyCollapsed = false,
    emptyText = "No outside lab results uploaded yet.",
  } = props;

  const [items, setItems] = useState<OtherLabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!initiallyCollapsed);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [ecgReports, setEcgReports] = useState<Record<string, EcgReportSummary>>({});
  const [reportsLoading, setReportsLoading] = useState(false);
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  useEffect(() => {
    let abort = false;
    setError(null);
    setItems(null);

    (async () => {
      try {
        // build URL correctly whether apiPath already has ?query or not
        const base = apiPath;
        const sep = base.includes("?") ? "&" : "?";
        const url = useSession
          ? base
          : `${base}${sep}patient_id=${encodeURIComponent(String(patientId || ""))}`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as OtherLabItem[];
        if (!abort) setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!abort) setError(e?.message || "Failed to load");
      }
    })();

    return () => { abort = true; };
  }, [patientId, useSession, apiPath]);

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
    if (!items) return {} as Record<string, OtherLabItem[]>;
    const by: Record<string, OtherLabItem[]> = {};
    for (const it of items) {
      const key = (it.type || "Uncategorized").trim();
      (by[key] ||= []).push(it);
    }
    for (const k of Object.keys(by)) {
      by[k].sort(
        (a, b) =>
          new Date(b.taken_at || b.uploaded_at || 0).getTime() -
          new Date(a.taken_at || a.uploaded_at || 0).getTime()
      );
    }
    return by;
  }, [items]);

  const providers = useMemo(() => Object.keys(grouped), [grouped]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => { if (providers.length && !active) setActive(providers[0]); }, [providers, active]);

  if (!showIfEmpty && items && items.length === 0) return null;

  return (
    <section
      className={
        "relative overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur px-5 py-5 md:px-6 md:py-6 transition " +
        className
      }
      style={{ boxShadow: "0 24px 55px rgba(15,23,42,0.1)" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{ background: accent }}
        aria-hidden
      />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 md:text-xl">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {items && items.length > 0 && (
            <span className="hidden text-xs text-slate-500 sm:inline">
              {items.length} file{items.length > 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            aria-expanded={open}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </header>

      {!open ? null : (
        <div className="mt-4">
          {!items && !error && <div className="text-sm text-gray-500">Loading other lab files…</div>}
          {error && <div className="text-sm text-red-600">Failed to load: {error}</div>}
          {/* Empty */}
          {items && items.length === 0 && (
            <div className="text-sm text-gray-500">{emptyText}</div>
          )}

          {items && items.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {providers.map((p) => (
                  <button
                    key={p}
                    onClick={() => setActive(p)}
                    className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition ${
                      active === p
                        ? "border-transparent text-white shadow-[0_10px_22px_rgba(68,150,155,0.25)]"
                        : "border-slate-200 text-slate-600 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow"
                    }`}
                    style={{
                      background: active === p ? accent : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {(grouped[active || providers[0]] || []).map((item) => {
                  const isImg = item.content_type?.startsWith("image/");
                  const isPdf = item.content_type === "application/pdf" || item.url.toLowerCase().endsWith(".pdf");
                  const isEcg = isEcgItem(item);
                  const report = isEcg ? ecgReports[item.id] : undefined;
                  return (
                    <div key={item.id} className="group relative rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_14px_35px_rgba(15,23,42,0.07)] backdrop-blur transition">
                      {isImg ? (
                        <button
                          type="button"
                          onClick={() => setImgSrc(item.url)}
                          className="block w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 shadow-inner"
                          title={`${fmtDate(item.taken_at)} — ${fileNameFromUrl(item.url)}`}
                        >
                          <img
                            src={item.url}
                            alt={item.note || fileNameFromUrl(item.url)}
                            className="aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-[1.02] group-hover:opacity-95"
                            loading="lazy"
                          />
                        </button>
                      ) : isPdf ? (
                        <button
                          type="button"
                          onClick={() => setPdfSrc(item.url)}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-3 text-left transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                          title={fileNameFromUrl(item.url)}
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6"><path d="M6 2h7l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="currentColor"/></svg>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-800">{fileNameFromUrl(item.url)}</div>
                            <div className="text-xs text-slate-500">{fmtDate(item.taken_at)}</div>
                          </div>
                        </button>
                      ) : (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                        >
                          <div className="truncate text-sm font-semibold text-slate-800">{fileNameFromUrl(item.url)}</div>
                          <div className="text-xs text-slate-500">
                            {item.content_type || "file"} • {fmtDate(item.taken_at)}
                          </div>
                        </a>
                      )}
                      <div className="mt-2 text-xs font-medium text-slate-500">
                        {fmtDate(item.taken_at)}
                        {item.provider ? ` • ${item.provider}` : ""}
                      </div>
                      <div className="mt-2 space-y-2 text-xs text-slate-600">
                        {isEcg ? (
                          <div>
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
                                ? "Checking interpretation…"
                                : "Awaiting interpretation"}
                            </span>
                            {report?.interpreted_name && (
                              <div className="mt-1 text-[11px] text-slate-500">
                                by {report.interpreted_name}
                                {report.interpreted_license ? ` • PRC ${report.interpreted_license}` : ""}
                              </div>
                            )}
                            {!report && !reportsLoading && (
                              <div className="mt-1 text-[11px] text-slate-400">
                                Doctor review pending.
                              </div>
                            )}
                          </div>
                        ) : null}

                        {isEcg && report?.impression && (
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2 text-xs text-emerald-900">
                            <div className="mb-1 font-semibold uppercase tracking-wide text-[10px] text-emerald-700">
                              Interpretation
                            </div>
                            <div className="text-[12px] leading-snug whitespace-pre-wrap">{report.impression}</div>
                            {report.recommendations && (
                              <div className="mt-1 text-[11px] text-emerald-800">
                                <span className="font-medium">Recommendations:</span>{" "}
                                {report.recommendations}
                              </div>
                            )}
                          </div>
                        )}

                        {!isEcg && item.impression && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-700 whitespace-pre-wrap">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                              Impression
                            </span>
                            {item.impression}
                          </div>
                        )}
                        {!isEcg && !item.impression && item.note && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-600 whitespace-pre-wrap">
                            {item.note}
                          </div>
                        )}
                        {isEcg && !report?.impression && item.impression && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-600 whitespace-pre-wrap">
                            {item.impression}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {imgSrc && <ImageLightbox src={imgSrc} onClose={() => setImgSrc(null)} />}
      {pdfSrc && <PdfLightbox src={pdfSrc} onClose={() => setPdfSrc(null)} />}
    </section>
  );
}

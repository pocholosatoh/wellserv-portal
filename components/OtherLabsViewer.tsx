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
  provider?: string | null;
  taken_at?: string | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  note?: string | null;
};

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
  console.log("[OtherLabsViewer] apiPath =", apiPath);

  const [items, setItems] = useState<OtherLabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!initiallyCollapsed);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);

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
    <section className={"rounded-2xl border bg-white/70 backdrop-blur p-4 md:p-5 shadow-sm " + className}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /> {title}
        </h2>
        <div className="flex items-center gap-2">
          {items && items.length > 0 && <span className="text-xs text-gray-500 hidden sm:inline">{items.length} file{items.length > 1 ? "s" : ""}</span>}
          <button onClick={() => setOpen(v => !v)} className="text-sm px-3 py-1.5 rounded-full border hover:bg-gray-50" aria-expanded={open}>
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
                    className={`px-3 py-1.5 rounded-full border text-sm ${active === p ? "bg-gray-900 text-white" : "hover:bg-gray-50"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(grouped[active || providers[0]] || []).map((item) => {
                  const isImg = item.content_type?.startsWith("image/");
                  const isPdf = item.content_type === "application/pdf" || item.url.toLowerCase().endsWith(".pdf");
                  return (
                    <div key={item.id} className="group relative">
                      {isImg ? (
                        <button
                          type="button"
                          onClick={() => setImgSrc(item.url)}
                          className="block w-full overflow-hidden rounded-xl border bg-gray-50"
                          title={`${fmtDate(item.taken_at)} — ${fileNameFromUrl(item.url)}`}
                        >
                          <img
                            src={item.url}
                            alt={item.note || fileNameFromUrl(item.url)}
                            className="aspect-[4/3] w-full object-cover group-hover:opacity-90"
                            loading="lazy"
                          />
                        </button>
                      ) : isPdf ? (
                        <button
                          type="button"
                          onClick={() => setPdfSrc(item.url)}
                          className="group flex w-full items-center gap-3 p-3 rounded-xl border hover:shadow transition bg-white text-left"
                          title={fileNameFromUrl(item.url)}
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 border">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6"><path d="M6 2h7l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="currentColor"/></svg>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{fileNameFromUrl(item.url)}</div>
                            <div className="text-xs text-gray-500">{fmtDate(item.taken_at)}</div>
                          </div>
                        </button>
                      ) : (
                        <a href={item.url} target="_blank" rel="noreferrer" className="block p-3 rounded-xl border bg-white">
                          <div className="font-medium text-sm truncate">{fileNameFromUrl(item.url)}</div>
                          <div className="text-xs text-gray-500">{item.content_type || "file"} • {fmtDate(item.taken_at)}</div>
                        </a>
                      )}
                      <div className="mt-1 text-xs text-gray-500">
                        {fmtDate(item.taken_at)}
                        {item.provider ? ` • ${item.provider}` : ""}
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

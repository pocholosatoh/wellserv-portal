"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";

// ---------- types ----------
type RefInfo = { low?: number; high?: number; normal_values?: string };
type ReportItem = { key:string; label:string; value:string; unit?:string; flag?:""|"L"|"H"|"A"; ref?: RefInfo };
type ReportSection = { name:string; items:ReportItem[] };
type Patient = { patient_id:string; full_name:string; age:string; sex:string; birthday:string; contact:string; address:string };
type Visit = { date_of_test:string; barcode:string; notes:string; branch?: string };
type Report = { patient:Patient; visit:Visit; sections:ReportSection[] };
export type ReportResponse = { count:number; reports:Report[]; config?: Record<string,string> };

// ---------- helpers ----------
function formatRef(ref?: RefInfo) {
  if (!ref) return "";
  const hasLow  = typeof ref.low  === "number";
  const hasHigh = typeof ref.high === "number";
  if (hasLow && hasHigh) return `${ref.low}–${ref.high}`;
  if (hasLow)  return `≥ ${ref.low}`;
  if (hasHigh) return `≤ ${ref.high}`;
  if (ref.normal_values) return ref.normal_values;
  return "";
}

function formatTestDate(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d; // keep whatever the sheet has
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// --- Patient Summary helpers ---
const num = (x: any): number | null => {
  const s = String(x ?? "").replace(/[^\d.-]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const heightM = (ft?: any, inch?: any): number | null => {
  const f = num(ft) ?? 0, i = num(inch) ?? 0;
  const totalIn = f * 12 + i;
  return totalIn > 0 ? totalIn * 0.0254 : null;
};
const bmiFromFtInKg = (ft?: any, inch?: any, kg?: any): number | null => {
  const m = heightM(ft, inch);
  const w = num(kg);
  if (!m || !w) return null;
  return Math.round((w / (m * m)) * 10) / 10;
};
const bmiClass = (bmi: number): string => {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
};
const fmtFtIn = (ft?: any, inch?: any): string => {
  const f = num(ft), i = num(inch);
  if (f == null && i == null) return "";
  return `${f ?? 0}′ ${i ?? 0}″`;
};
const withUnit = (v: any, u: string): string =>
  String(v ?? "").toString().trim() ? `${v} ${u}` : "";
const suffixIfNumeric = (v: any, suffix: string): string => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return num(s) != null ? `${s} ${suffix}` : s; // accept free text too
};

// Exact keys you never want to appear in "Prev"
const EXCLUDE_EXACT_KEYS = new Set([
  "chem_remarks",
  "hema_remarks",
  "ua_remarks",
  "fa_remarks",
  "sero_remarks",
]);

// Optional exact labels to exclude (covers lines like "RESULTS/S", "Remarks")
const EXCLUDE_EXACT_LABELS = new Set(["remarks", "results", "result", "results/s"]);

function shouldExcludeFromPrev(it: ReportItem, cfg?: Record<string, string>): boolean {
  const keyRaw = String(it.key || "").trim().toLowerCase();
  const labelRaw = String(it.label || "").trim().toLowerCase().replace(/[:]/g, "");
  if (EXCLUDE_EXACT_KEYS.has(keyRaw)) return true;
  if (EXCLUDE_EXACT_LABELS.has(labelRaw)) return true;

  const cfgKeys = (cfg?.prev_exclude_keys || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (cfgKeys.includes(keyRaw)) return true;

  const norm = (s?: string) =>
    String(s || "").toLowerCase().replace(/[_\-:.]+/g, " ").replace(/\s+/g, " ").trim();
  const label = norm(it.label);
  const keyNorm = norm(it.key);
  const builtins = ["remark", "remarks", "note", "notes", "comment", "comments", "interpretation"];
  if (builtins.some(t => label.includes(t) || keyNorm.includes(t))) return true;

  return false;
}

// parse a numeric string
function toNum(s?: string): number | null {
  const t = String(s ?? "").replace(/,/g, "").trim();
  const m = t.match(/^[-+]?\d*\.?\d+$/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

// Footer lines from config
function getFooterLines(cfg: Record<string, string> | undefined): string[] {
  if (!cfg) return [];
  const keys = Object.keys(cfg).filter(k => /^report_footer_line\d+$/i.test(k));
  keys.sort((a, b) => {
    const na = parseInt(a.match(/\d+/)![0], 10);
    const nb = parseInt(b.match(/\d+/)![0], 10);
    return na - nb;
  });
  const lines: string[] = [];
  for (const k of keys) {
    const raw = (cfg[k] ?? "").toString().trim();
    if (!raw) continue;
    raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(s => lines.push(s));
  }
  return lines;
}

function extractDriveId(url?: string) {
  const u = (url || "").trim();
  if (!u) return "";
  const uc = u.match(/[?&]id=([^&]+)/);
  if (uc?.[1]) return uc[1];
  const file = u.match(/\/file\/d\/([^/]+)/);
  if (file?.[1]) return file[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(u)) return u;
  return "";
}
function driveImageUrls(url?: string) {
  const id = extractDriveId(url);
  if (!id) return { primary: "", fallback: "" };
  return {
    primary: `https://drive.google.com/uc?export=view&id=${id}`,
    fallback: `https://lh3.googleusercontent.com/d/${id}`,
  };
}

function formatPrevDate(s: string): string {
  let y = 0, m = 0, d = 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yy, mm, dd] = s.split("-").map(Number);
    y = yy; m = mm; d = dd;
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [mm, dd, yy] = s.split("/").map(Number);
    y = yy; m = mm; d = dd;
  } else {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
    }
  }
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const yy2 = String(y).slice(-2);
  return `${pad2(m)}/${pad2(d)}/'${yy2}`;
}

function getSignersFromConfig(cfg: Record<string,string>) {
  const rmts: Array<{ role: string; name: string; license?: string; sig?: string }> = [];
  const push = (n: string, l: string, s: string) => {
    const name = (cfg[n] || "").trim();
    if (!name) return;
    rmts.push({ role: "RMT", name, license: (cfg[l] || "").trim(), sig: (cfg[s] || "").trim() });
  };
  push("rmt_name", "rmt_license", "rmt_signature_url");
  for (let i = 1; i <= 6; i++) push(`rmt${i}_name`, `rmt${i}_license`, `rmt${i}_signature_url`);

  const pathoName = (cfg.patho_name || "").trim();
  const pathos = pathoName
    ? [{ role: "Pathologist", name: pathoName, license: (cfg.patho_license || "").trim(), sig: (cfg.patho_signature_url || "").trim() }]
    : [];
  return { rmts, pathos };
}

function toImageUrl(url?: string) {
  if (!url) return "";
  const m = url.match(/[-\w]{25,}/);
  return m ? `https://drive.google.com/uc?export=view&id=${m[0]}` : url;
}

function ts(d?: string | null): number {
  if (!d) return 0;
  const s = String(d).trim();
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return t;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    const isDMY = a > 12;
    const month = (isDMY ? b : a) - 1;
    const day   = isDMY ? a : b;
    return new Date(y, month, day).getTime();
  }
  return 0;
}

type ReportViewerProps = {
  initialPatientId?: string;
  apiPath?: string;
  autoFetch?: boolean;

  // NEW (optional, non-breaking):
  headerOverride?: ReactNode;   // custom header JSX from parent
  watermarkSizePx?: number;     // e.g., 320 (overrides size for screen/print)
  watermarkOpacity?: number;    // e.g., 0.05 (applies to screen & print)
};

export default function ReportViewer(props: ReportViewerProps) {
  const {
    initialPatientId,
    apiPath = "/api/results",
    autoFetch = false,

    // NEW overrides
    headerOverride,
    watermarkSizePx,
    watermarkOpacity,
  } = props;

  const [patientId, setPatientId] = useState(initialPatientId ?? "");

  useEffect(() => {
  if (initialPatientId) setPatientId(initialPatientId);
}, [initialPatientId]);

  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [bootCfg, setBootCfg] = useState<Record<string, string> | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  // Splash / preload states
  const [bootLoaded, setBootLoaded] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [wmImgLoaded, setWmImgLoaded] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (!ignore && json?.config) setBootCfg(json.config as Record<string,string>);
        }
      } catch {}
      finally {
        if (!ignore) setBootLoaded(true);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const cfg = { ...(bootCfg || {}), ...(data?.config || {}) } as Record<string,string>;
  const reports = data?.reports ?? [];

  // Dashboard footer visibility toggles
  const showFooterOnDashboard = (cfg?.footer_show_on_dashboard || "").toLowerCase() === "true";
  const showSignersOnDashboard = (cfg?.footer_show_signers_on_dashboard || "").toLowerCase() === "true";
  const hasReport = (reports?.length ?? 0) > 0;
  const showFooter = hasReport || showFooterOnDashboard;
  const showSigners = hasReport || showSignersOnDashboard;

  // Footer + style knobs
  const footerLines = getFooterLines(cfg);
  const footerAlign = ((cfg?.report_footer_align ?? "center").toString().toLowerCase() as "left" | "center" | "right");
  const footerFontPx = Number(cfg?.report_footer_font_px) || 10;
  const footerGapPx  = Number(cfg?.report_footer_gap_px)  || 4;

  // Watermark config
  const { primary: wmPrimary, fallback: wmFallback } = driveImageUrls(cfg?.watermark_image_url);
  const wmImgUrl = wmPrimary || wmFallback;
  const wmText = (cfg?.watermark_text || "").trim();

  useEffect(() => {
    setWmImgLoaded(false);
    if (!wmImgUrl) { setWmImgLoaded(true); return; }
    const img = new Image();
    img.onload = img.onerror = () => setWmImgLoaded(true);
    img.src = wmImgUrl;
  }, [wmImgUrl]);

  const wmShowScreen = (cfg?.watermark_show_dashboard || "true").toLowerCase() === "true";
  const wmShowPrint  = (cfg?.watermark_show_print    || "true").toLowerCase() === "true";
  const wmOpacityScreen = Math.max(0, Math.min(1, Number(cfg?.watermark_opacity_screen || 0.12)));
  const wmOpacityPrint  = Math.max(0, Math.min(1, Number(cfg?.watermark_opacity_print  || 0.08)));
  const wmAngleDeg = Number(cfg?.watermark_angle_deg || -30);
  const wmSize = (cfg?.watermark_size || "40vw");
  const wmFallbackText = (cfg?.watermark_default_text || (reports.length === 0 ? "WELLSERV" : "")).trim();

  // --- Prop overrides (optional) ---
  const wmSizeEffective =
    typeof watermarkSizePx === "number" ? `${watermarkSizePx}px` : wmSize;

  const wmOpacityScreenEffective =
    typeof watermarkOpacity === "number" ? watermarkOpacity : wmOpacityScreen;

  const wmOpacityPrintEffective =
    typeof watermarkOpacity === "number" ? watermarkOpacity : wmOpacityPrint;

  const hasWm = Boolean(wmText || wmImgUrl || wmFallbackText);

  const showVisitNotes = (cfg?.show_visit_notes || "").toLowerCase() === "true";

  // Visits
  const visitDates = useMemo(() => {
  const dates = Array.from(
    new Set(
      reports
        .map((r: any) => String(r?.visit?.date_of_test ?? ""))
        .filter(Boolean)
    )
  ).sort((a, b) => ts(b) - ts(a)); // ← real date sort
  return dates;
}, [reports]);

  const report = useMemo(() => {
    if (!Array.isArray(reports) || reports.length === 0) return undefined;
    const current = selectedDate || (visitDates[0] ?? "");
    return (
      reports.find((r: any) => (r?.visit?.date_of_test ?? "") === current) ||
      reports[0]
    );
  }, [reports, selectedDate, visitDates]);

  async function fetchReports(id: string) {
    if (!id) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: id }),
      });

      const ct = res.headers.get("content-type") || "";
      let json: any = null;
      let text = "";
      try {
        if (ct.includes("application/json")) {
          json = await res.json();
        } else {
          text = await res.text();
        }
      } catch {
        // parsing failed — try reading text for debugging
        try { text = await res.text(); } catch {}
      }

      if (!res.ok) {
        const msg = json?.error || text || `Request failed (${res.status})`;
        setErr(msg);
        setData(null);
        setSelectedDate("");
        return;
      }

      // normalize possible shapes
      const reports: any[] =
        (Array.isArray(json?.reports) && json.reports) ||
        (Array.isArray(json?.rows) && json.rows) ||
        (Array.isArray(json?.data) && json.data) ||
        [];

      if (reports.length === 0) {
        setErr("No matching patient ID, please try again.");
        setData(null);
        setSelectedDate("");
        return;
      }

      const payload: ReportResponse = { count: reports.length, reports };
      if (json?.config && typeof json.config === "object") {
        payload.config = json.config as Record<string, string>;
      }
      setData(payload);

      const dates: string[] = Array.from(
        new Set<string>(
          reports.map((r: any) => String(r?.visit?.date_of_test ?? "")).filter(Boolean)
        )
      ).sort((a: string, b: string) => ts(b) - ts(a));
      setSelectedDate(dates[0] ?? "");
    } catch (e: any) {
      setErr(e?.message || "Network error.");
      setData(null);
      setSelectedDate("");
    } finally {
      setLoading(false);
    }
  }


    useEffect(() => {
        if (autoFetch && patientId) {
        fetchReports(patientId);
        }
    }, [autoFetch, patientId]);

  // Build index for previous values
  const valueIndex = useMemo(() => {
    const map = new Map<string, Map<string, { raw: string; num: number | null; unit?: string }>>();
    for (const r of reports) {
      const d = r.visit.date_of_test;
      let m = map.get(d);
      if (!m) { m = new Map(); map.set(d, m); }
      for (const s of r.sections) {
        for (const it of s.items) {
          if (shouldExcludeFromPrev(it, cfg)) continue;
          const raw = String(it.value ?? "").trim();
          if (!raw) continue;
          const num = toNum(raw);
          m.set(it.key, { raw, num, unit: it.unit });
        }
      }
    }
    return map;
  }, [reports, cfg]);

  function findPrevListAny(it: ReportItem, maxCount = 3): Array<{ date: string; raw: string; num: number | null; unit?: string }> {
    if (!report) return [];
    const currentDate = report.visit.date_of_test;
    const idx = visitDates.indexOf(currentDate);
    if (idx < 0) return [];
    const out: Array<{ date: string; raw: string; num: number | null; unit?: string }> = [];
    for (let i = idx + 1; i < visitDates.length && out.length < maxCount; i++) {
      const d = visitDates[i];
      const rec = valueIndex.get(d)?.get(it.key);
      if (!rec) continue;
      out.push({ date: d, raw: rec.raw, num: rec.num, unit: rec.unit });
    }
    return out;
  }

  function findPrevNumForDelta(it: ReportItem): { date: string; value: number } | null {
    if (!report) return null;
    const currentDate = report.visit.date_of_test;
    const idx = visitDates.indexOf(currentDate);
    if (idx < 0) return null;
    const curNum = toNum(it.value);
    if (curNum == null) return null;
    for (let i = idx + 1; i < visitDates.length; i++) {
      const d = visitDates[i];
      const rec = valueIndex.get(d)?.get(it.key);
      if (!rec || rec.num == null) continue;
      if (it.unit && rec.unit && it.unit !== rec.unit) continue;
      return { date: d, value: rec.num };
    }
    return null;
  }

  async function search() {
  if (!patientId) return;
  setErr("");
  setLoading(true);
  try {
    const res = await fetch(`/api/report?patient_id=${encodeURIComponent(patientId)}`);
    const json: any = await res.json();

    const reports: any[] =
      (Array.isArray(json?.reports) && json.reports) ||
      (Array.isArray(json?.rows) && json.rows) ||
      (Array.isArray(json?.data) && json.data) ||
      [];

    if (!res.ok) {
      setErr(json?.error || "Something went wrong.");
      setData(null);
      setSelectedDate("");
      return;
    }
    if (reports.length === 0) {
      setErr("No matching patient ID, please try again.");
      setData(null);
      setSelectedDate("");
      return;
    }

    const payload: ReportResponse = { count: reports.length, reports };
    if (json?.config && typeof json.config === "object") {
      payload.config = json.config as Record<string, string>;
    }
    setData(payload);

    const dates: string[] = Array.from(
      new Set<string>(
        reports.map((r: any) => String(r?.visit?.date_of_test ?? "")).filter(Boolean)
      )
    ).sort((a: string, b: string) => ts(b) - ts(a));
    setSelectedDate(dates[0] ?? "");
  } catch (e: any) {
    setErr(e?.message || "Network error.");
    setData(null);
    setSelectedDate("");
  } finally {
    setLoading(false);
  }
}

  // signers + logo (computed BEFORE return)
  const { rmts, pathos } = getSignersFromConfig(cfg);
  const signers = [...rmts, ...pathos];

  const rawLogo = (cfg?.clinic_logo_url || "").trim();
  let logoSrc = "";
  let logoFallback = "";

if (rawLogo.startsWith("/") || /^https?:\/\//i.test(rawLogo)) {
  // Local public path (e.g., "/wellserv-logo.png") or direct URL
  logoSrc = rawLogo;
} else {
  // Google Drive ID / URL (existing behavior)
  const d = driveImageUrls(rawLogo);
  logoSrc = d.primary;
  logoFallback = d.fallback;
}

  useEffect(() => {
    setLogoLoaded(false);
    if (!logoSrc) { setLogoLoaded(true); return; }
    const img = new Image();
    img.onload = img.onerror = () => setLogoLoaded(true);
    img.src = logoSrc;
  }, [logoSrc]);

  // Splash control
  const splashEnabled = (cfg?.loading_splash_enabled ?? "true").toString().toLowerCase() === "true";
  const splashMaxMs   = Number(cfg?.loading_splash_max_ms ?? 900);
  const readyTargetsOk = bootLoaded && logoLoaded && wmImgLoaded;

  useEffect(() => {
    if (!splashEnabled) { setSplashDone(true); return; }
    if (readyTargetsOk) { setSplashDone(true); return; }
    const t = setTimeout(() => setSplashDone(true), splashMaxMs);
    return () => clearTimeout(t);
  }, [splashEnabled, readyTargetsOk, splashMaxMs]);

  const showSplash = splashEnabled && !splashDone;

  return (
    <div className="page" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <style>{`
        :root{
          --font-base: 14px;
          --font-heading: 18px;
          --font-title: 18px;
          --row-pad: 6px;
          --sig-height: 30px;
          --logo-height: 150px;
          --brand: #000000ff;
          --accent: #0f766e;
          --border: #ddd;
        }
        body { font-size: var(--font-base); color: var(--brand); }
        h1 { font-size: var(--font-title); }
        h3 { font-size: var(--font-heading); }

        .container { max-width: 960px; margin: 0 auto; padding: 16px; }
        .content { flex: 1 0 auto; }
        th, td { padding: var(--row-pad); }

        /* clinic header */
        .clinic { display:flex; align-items:center; gap:12px; margin: 8px 0 12px 0; }
        .clinic img { height: var(--logo-height); width:auto; object-fit: contain; display:block; }
        .clinic-name { font-weight: 700; font-size: 20px; line-height: 1.2; }
        .clinic-sub { color:#444; }

        /* toolbar with title + search (moves search next to the title) */
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: center;   /* ✅ center the whole group */
          gap: 12px;                  /* space between title and input/button */
          margin: 6px auto 8px;       /* keep it centered as a block */
          flex-wrap: wrap;            /* wrap nicely on narrow screens */
          width: 100%;
        }
        .toolbar h1 { margin: 0; }
        .searchbar { display:flex; gap:8px; align-items:center; }

        /* patient header (name, sex/age/DOB) */
        .patient-head {
          display:flex; align-items:baseline; justify-content:space-between;
          gap:12px; padding:10px 12px; margin: 8px 0 10px;
          border:1px solid var(--border); border-radius:12px; background:#fff;
        }
        .ph-name { font-size: 20px; font-weight: 800; letter-spacing: .2px; }
        .ph-meta { color:#444; }

        /* controls row under summary */
        .controls { display:flex; gap:12px; margin:12px 0; flex-wrap:wrap; }

        /* footer */
        .report-footer { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); font-size: 14px; color: var(--brand); }
        .sig-row { display:flex; gap:16px; align-items:flex-end; flex-wrap: wrap; }
        .sig { flex:1; min-width:260px; text-align:center; margin-top:8px; }
        .sig img { max-height: var(--sig-height); width: auto; object-fit: contain; display:block; margin: 0 auto 6px; }
        .muted { color:#444; font-size: 12px; }

        table { width:100%; border-collapse: collapse; }
        thead th { border-bottom: 1px solid var(--border); }
        tbody td { border-bottom: 1px solid rgba(0,0,0,0.04); }

        @media print {
          .toolbar, .controls { display:none !important; }
          .report-footer { page-break-inside: avoid; }
          body { margin: 0; }
        }

        /* --- Watermark layer --- */
        .page { position: relative; }
        .page > * { position: relative; z-index: 1; }
        .wm-layer { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
        .wm-text { font-weight: 700; color: #000; letter-spacing: 0.1em; font-size: var(--wm-size, 10vw); white-space: nowrap; text-transform: uppercase; mix-blend-mode: multiply; opacity: var(--wm-opacity, 0.08); transform: rotate(var(--wm-angle, -30deg)); }
        .wm-img { width: var(--wm-size, 60vw); height: auto; opacity: var(--wm-opacity, 0.06); transform: rotate(var(--wm-angle, -30deg)); }
        @media print {
          .wm-layer { display: flex !important; }
          .wm-layer[data-print="off"] { display: none !important; }
          .wm-text, .wm-img { opacity: var(--wm-opacity-print, 0.08); }
        }

        /* Splash overlay */
        .splash { position: fixed; inset: 0; display: grid; place-items: center; background: #fff; z-index: 9999; opacity: 1; transition: opacity .2s ease; }
        .splash-inner { text-align: center; display: grid; gap: 10px; }
        .splash-text { font-size: 14px; color: #666; }
        .splash-dot { width: 6px; height: 6px; border-radius: 9999px; background: #222; margin: 6px auto 0; animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { transform: scale(0.8); opacity: .4; } 50% { transform: scale(1.3); opacity: 1; } }

        /* Patient Summary Card */
        .ps-card { border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin: 10px 0 14px; background: #fafafa; }
        .ps-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
        .ps-title { font-weight: 700; }
        .ps-badge { font-size:12px; color:#555; background:#f0f0f0; border:1px solid #e6e6e6; border-radius:999px; padding:2px 8px; }
        .ps-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 10px 16px; }
        .ps-label { color:#666; font-size:12px; }
        .ps-value { font-weight:600; }
        .ps-multi { white-space:pre-wrap; line-height:1.25; }
        .ps-pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #ddd; background:#fff; }
        .ps-sep { grid-column:1 / -1; height:1px; background:#e9e9e9; margin:6px 0; }

        @media print { .ps-card { page-break-inside: avoid; background: #fff; } }
      `}</style>

      {showSplash && (
        <div className="splash">
          <div className="splash-inner">
            {logoSrc ? <img src={logoSrc} alt="" referrerPolicy="no-referrer" style={{ maxHeight: 72 }} /> : null}
            <div className="splash-text">{cfg?.loading_splash_text || "Loading WELLSERV® Portal…"}</div>
            <div className="splash-dot" aria-hidden />
          </div>
        </div>
      )}

      {!showSplash && hasWm && (
        <div
          className="wm-layer"
          data-print={wmShowPrint ? "on" : "off"}
          style={{
            display: wmShowScreen ? "flex" : "none",
            ["--wm-opacity" as any]: String(wmOpacityScreenEffective),
            ["--wm-opacity-print" as any]: String(wmOpacityPrintEffective),
            ["--wm-angle" as any]: `${wmAngleDeg}deg`,
            ["--wm-size" as any]: wmSizeEffective,
          }}
          aria-hidden="true"
        >
          {wmImgUrl ? (
            <img
              className="wm-img"
              src={wmImgUrl}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (wmFallback && img.src !== wmFallback) img.src = wmFallback; else img.style.display = "none";
              }}
              alt=""
            />
          ) : (
            <div className="wm-text">{wmText || wmFallbackText}</div>
          )}
        </div>
      )}

      <div className="container content" style={{ opacity: showSplash ? 0 : 1, pointerEvents: showSplash ? "none" : "auto" }}>
        {/* ---------- CLINIC HEADER (override-able) ---------- */}
        {headerOverride ? (
          <div className="mb-2">{headerOverride}</div>
        ) : (
          (cfg.clinic_name || cfg.clinic_logo_url || cfg.clinic_address || cfg.clinic_phone) && (
            <div className="clinic" style={{ flexDirection:"column", alignItems:"center", textAlign:"center" }}>
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{ display: "block", margin: "0 auto", maxHeight: 120 }}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (logoFallback && img.src !== logoFallback) img.src = logoFallback; else img.style.display = "none";
                  }}
                />
              ) : null}
              <div>
                {cfg.clinic_name && <div className="clinic-name">{cfg.clinic_name}</div>}
                {cfg.clinic_address && <div className="clinic-sub">{cfg.clinic_address}</div>}
                {cfg.clinic_phone && <div className="clinic-sub">{cfg.clinic_phone}</div>}
              </div>
            </div>
          )
        )}

        {/* ---------- Title + Search (STAFF ONLY) ---------- */}
        {!autoFetch && (
          <div className="toolbar print:hidden">
            <h1>View Lab Results</h1>
            <div className="searchbar">
              <input
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading && patientId.trim()) {
                    e.preventDefault();
                    fetchReports(patientId);
                  }
                }}
                placeholder="Enter Patient ID"
                style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, width: 260 }}
              />
              <button
                onClick={() => fetchReports(patientId)}
                disabled={loading || !patientId.trim()}
                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #44969b", background: "#44969b", color: "#fff" }}
              >
                {loading ? "Loading..." : "View"}
              </button>
            </div>
          </div>
        )}

        {/* ---------- Patient Header (above the card) ---------- */}
        {report && (
          <div className="patient-head">
            <div className="ph-name">{report.patient.full_name}</div>
            <div className="ph-meta">
              {report.patient.sex} • {report.patient.age} yrs • DOB {report.patient.birthday}
            </div>
          </div>
        )}

        {/* ---------- Patient Summary Card ---------- */}
        {report && (() => {
          const p: any = report.patient || {};

          // Vitals & contact
          const htFt = p.height_ft, htIn = p.height_inch, wtKg = p.weight_kg;
          const bmi = bmiFromFtInKg(htFt, htIn, wtKg);
          const bpStr = (p.systolic_bp && p.diastolic_bp) ? `${p.systolic_bp}/${p.diastolic_bp} mmHg` : "";
          const smoking = suffixIfNumeric(p.smoking_hx, "packs/mo");
          const alcohol = suffixIfNumeric(p.alcohol_hx, "bottles/mo");

          const email = (p.email || "").trim();
          const phone = (p.contact || "").trim();
          const addr  = (p.address || "").trim();

          // Narratives
          const chief = (p.chief_complaint || "").trim();
          const hpi   = (p.present_illness_history || "").trim();
          const pmh   = (p.past_medical_history || "").trim();
          const psh   = (p.past_surgical_history || "").trim();
          const allergies = (p.allergies_text || "").trim();
          const medsText  = (p.medications_current || p.medications || "").trim();
          const famHx = (p.family_hx || p.family_history || "").trim();

          const lastUpd = (p.last_updated || "").trim();

          const hasVitals = (!!htFt || !!htIn || !!wtKg || !!bmi || !!bpStr || !!smoking || !!alcohol);
          const hasContact = (!!email || !!phone || !!addr);
          const hasNarr = (!!chief || !!hpi || !!pmh || !!psh || !!allergies || !!medsText || !!famHx);

          if (!hasVitals && !hasContact && !hasNarr) return null;

          return (
            <section className="ps-card">
              <div className="ps-head">
                <div className="ps-title">Patient Summary</div>
                {lastUpd && <div className="ps-badge">Last updated: {lastUpd}</div>}
              </div>

              <div className="ps-grid">
                {/* VITALS */}
                {(htFt || htIn) && (<div><div className="ps-label">Height</div><div className="ps-value">{fmtFtIn(htFt, htIn)}</div></div>)}
                {!!wtKg && (<div><div className="ps-label">Weight</div><div className="ps-value">{withUnit(wtKg, "kg")}</div></div>)}
                {bmi != null && (
                  <div>
                    <div className="ps-label">Calculated BMI</div>
                    <div className="ps-value">{bmi} <span className="ps-pill">{bmiClass(bmi)}</span></div>
                  </div>
                )}
                {!!bpStr && (<div><div className="ps-label">Latest Known Blood Pressure</div><div className="ps-value">{bpStr}</div></div>)}
                {!!smoking && (<div><div className="ps-label">Smoking History</div><div className="ps-value">{smoking}</div></div>)}
                {!!alcohol && (<div><div className="ps-label">Alcohol History</div><div className="ps-value">{alcohol}</div></div>)}

                {/* CONTACT */}
                {!!phone && (<div><div className="ps-label">Contact Number</div><div className="ps-value">{phone}</div></div>)}
                {!!email && (<div><div className="ps-label">Email</div><div className="ps-value">{email}</div></div>)}
                {!!addr  && (<div><div className="ps-label">Address</div><div className="ps-value ps-multi">{addr}</div></div>)}

                {/* subtle divider between contact/address and narratives */}
                {(hasContact && hasNarr) && <div className="ps-sep" />}

                {/* NARRATIVES */}
                {!!chief && (<div><div className="ps-label">Chief Complaint</div><div className="ps-value ps-multi">{chief}</div></div>)}
                {!!hpi   && (<div><div className="ps-label">Present Illness History</div><div className="ps-value ps-multi">{hpi}</div></div>)}
                {!!pmh   && (<div><div className="ps-label">Past Medical History</div><div className="ps-value ps-multi">{pmh}</div></div>)}
                {!!psh   && (<div><div className="ps-label">Past Surgical History</div><div className="ps-value ps-multi">{psh}</div></div>)}
                {!!allergies && (<div><div className="ps-label">Allergies</div><div className="ps-value ps-multi">{allergies}</div></div>)}
                {!!medsText  && (<div><div className="ps-label">Medications</div><div className="ps-value ps-multi">{medsText}</div></div>)}
                {!!famHx     && (<div><div className="ps-label">Family History</div><div className="ps-value ps-multi">{famHx}</div></div>)}
              </div>
            </section>
          );
        })()}
        
        {/* Print-only Test date between Patient Summary and Results */}
        {(report?.visit?.date_of_test || report?.visit?.branch) && (
          <div className="hidden print:block mt-3 mb-4">
            <div style={{ paddingTop: 8, fontSize: 14 }}>
              {report?.visit?.date_of_test && (
                <>
                  <span style={{ fontWeight: 600 }}>Test date:</span>{" "}
                  {formatTestDate(report.visit.date_of_test)}
                </>
              )}
              {report?.visit?.branch && (
                <>
                  {" "}• <span style={{ fontWeight: 600 }}>Branch:</span>{" "}
                  {report.visit.branch}
                </>
              )}
            </div>
          </div>
        )}

        {/* ---------- Controls: show ONLY after a report is loaded ---------- */}
        {report && (
          <div className="controls">
            {visitDates.length > 1 && (
              <label style={{ display:"flex", alignItems:"center", gap:6 }}>
                <input
                  type="checkbox"
                  checked={compareOn}
                  onChange={(e)=>setCompareOn(e.target.checked)}
                />
                Compare with prev. visit/s
              </label>
            )}

            {visitDates.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <label style={{ fontSize:14 }}>Visit date:</label>
                <select
                  value={selectedDate || ""}
                  onChange={(e)=>setSelectedDate(e.target.value)}
                  style={{ padding:"8px 10px", border:"1px solid var(--border)", borderRadius:6 }}
                >
                  {visitDates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <button
                  onClick={() => window.print()}
                  className="print:hidden"
                  style={{ padding:"8px 10px", border:"1px solid var(--border)", borderRadius:6 }}
                >
                  Print / Save as PDF
                </button>
              </div>
            )}
          </div>
        )}

        {err && <div style={{ color:"#b00020", marginTop:4 }}>{err}</div>}

        {report && (
          <>
            {report.sections
              .filter(sec => (sec?.items?.length ?? 0) > 0) // ← skip empty sections
              .map(section => {
                const hideRF = section.name === "Urinalysis" || section.name === "Fecalysis"; // ← hide columns for UA/FA

                return (
                  <div key={section.name} style={{ marginTop: 18 }}>
                    <h3 style={{ margin: "10px 0" }}>{section.name}</h3>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Parameter</th>
                          <th style={{ textAlign: "right" }}>Result</th>
                          {compareOn && <th style={{ textAlign: "right" }}>Prev. Res.</th>}
                          {compareOn && <th style={{ textAlign: "right" }}>Latest % Change</th>}
                          <th style={{ textAlign: "left" }}>Unit</th>
                          {!hideRF && <th style={{ textAlign: "left" }}>Reference</th>}
                          {!hideRF && <th style={{ textAlign: "center" }}>Current Flag</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map(it => {
                          if (!it.value) return null;

                          // extra defensive hide (in case old payloads sneak in)
                          const labelLc = String(it.label || "").trim().toLowerCase();
                          if (labelLc === "branch" || labelLc === "created at" || labelLc === "updated at") {
                            return null;
                          }

                          const refText = hideRF ? "" : formatRef(it.ref);
                          const cur = toNum(it.value);
                          const skipPrev = shouldExcludeFromPrev(it, cfg);
                          const prevList = compareOn && !skipPrev ? findPrevListAny(it, 3) : [];
                          const prev1Num = compareOn && !skipPrev ? findPrevNumForDelta(it) : null;

                          let deltaText = "—";
                          let deltaColor = "#666";
                          if (cur != null && prev1Num) {
                            const delta = cur - prev1Num.value;
                            const pct = prev1Num.value !== 0 ? (delta / prev1Num.value) * 100 : null;
                            const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
                            deltaText = `${arrow} ${delta > 0 ? "+" : ""}${fmt(delta)}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`;
                            deltaColor = delta > 0 ? "#b00020" : delta < 0 ? "#1976d2" : "#666";
                          }

                          return (
                            <tr key={it.key}>
                              <td>{it.label}</td>
                              <td style={{ textAlign: "right" }}>
                              {cur != null ? fmt(cur) : String(it.value ?? "")}
                            </td>

                              {compareOn && (
                                <>
                                  <td style={{ textAlign: "right" }}>
                                    {prevList.length ? (
                                      prevList.map(p => (
                                        <div key={p.date} style={{ whiteSpace: "nowrap", fontSize: 12, lineHeight: 1.2 }}>
                                          {formatPrevDate(p.date)}: {p.num != null ? fmt(p.num) : p.raw}
                                        </div>
                                      ))
                                    ) : "—"}
                                  </td>
                                  <td style={{ textAlign: "right", color: deltaColor }}>{deltaText}</td>
                                </>
                              )}

                              <td>{it.unit || ""}</td>
                              {!hideRF && <td>{refText}</td>}
                              {!hideRF && (
                                <td
                                  style={{
                                    textAlign: "center",
                                    color:
                                      it.flag === "H" ? "#b00020" :
                                      it.flag === "L" ? "#1976d2" :
                                      it.flag === "A" ? "#f57c00" : "#666"
                                  }}
                                >
                                  {it.flag || ""}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}            
          </>
        )}
      </div>

      {showFooter && (
        <footer className="report-footer container">
          {showSigners && signers.length > 0 && (
            <div className="sig-row">
              {signers.map((s, idx) => {
                const { primary, fallback } = driveImageUrls(s.sig);
                return (
                  <div key={idx} className="sig">
                    {primary ? (
                      <img
                        src={primary}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (fallback && img.src !== fallback) img.src = fallback; else img.style.display = "none";
                        }}
                      />
                    ) : null}
                    <div><strong>{s.name}</strong></div>
                    <div className="muted">{s.role}{s.license ? ` – PRC ${s.license}` : ""}</div>
                  </div>
                );
              })}
            </div>
          )}

          {footerLines.length > 0 && (
            <div
              style={{
                textAlign: footerAlign,
                marginTop: 10,
                lineHeight: 1.3,
                width: "100%",
                fontSize: `${footerFontPx}px`,
              }}
            >
              {footerLines.map((line, i) => (
                <div key={i} style={{ marginTop: i === 0 ? 0 : footerGapPx }}>{line}</div>
              ))}
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
"use client";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

// ---------- types ----------
type RefInfo = { low?: number; high?: number; normal_values?: string };
type ReportItem = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  flag?: "" | "L" | "H" | "A";
  ref?: RefInfo;
};
type ReportSection = { name: string; items: ReportItem[] };
type Patient = {
  patient_id: string;
  full_name: string;
  age: string;
  sex: string;
  birthday: string;
  contact: string;
  address: string;
};
type Visit = { date_of_test: string; barcode: string; notes: string; branch?: string };
type Report = { patient: Patient; visit: Visit; sections: ReportSection[] };
export type ReportResponse = {
  count: number;
  reports: Report[];
  config?: Record<string, string>;
  patientOnly?: boolean;
};

// ---------- helpers ----------
function formatRef(ref?: RefInfo) {
  if (!ref) return "";
  const hasLow = typeof ref.low === "number";
  const hasHigh = typeof ref.high === "number";
  if (hasLow && hasHigh) return `${ref.low}–${ref.high}`;
  if (hasLow) return `≥ ${ref.low}`;
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
  const s = String(x ?? "")
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const heightM = (ft?: any, inch?: any): number | null => {
  const f = num(ft) ?? 0,
    i = num(inch) ?? 0;
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
  const f = num(ft),
    i = num(inch);
  if (f == null && i == null) return "";
  return `${f ?? 0}′ ${i ?? 0}″`;
};
const ftInFromCm = (cm?: number | null): { ft: number; inch: number } | null => {
  if (cm == null) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return { ft, inch };
};
const withUnit = (v: any, u: string): string =>
  String(v ?? "")
    .toString()
    .trim()
    ? `${v} ${u}`
    : "";
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
  const keyRaw = String(it.key || "")
    .trim()
    .toLowerCase();
  const labelRaw = String(it.label || "")
    .trim()
    .toLowerCase()
    .replace(/[:]/g, "");
  if (EXCLUDE_EXACT_KEYS.has(keyRaw)) return true;
  if (EXCLUDE_EXACT_LABELS.has(labelRaw)) return true;

  const cfgKeys = (cfg?.prev_exclude_keys || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (cfgKeys.includes(keyRaw)) return true;

  const norm = (s?: string) =>
    String(s || "")
      .toLowerCase()
      .replace(/[_\-:.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const label = norm(it.label);
  const keyNorm = norm(it.key);
  const builtins = ["remark", "remarks", "note", "notes", "comment", "comments", "interpretation"];
  if (builtins.some((t) => label.includes(t) || keyNorm.includes(t))) return true;

  return false;
}

// parse a numeric string
function toNum(s?: string): number | null {
  const t = String(s ?? "")
    .replace(/,/g, "")
    .trim();
  const m = t.match(/^[-+]?\d*\.?\d+$/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

// Footer lines from config
function getFooterLines(cfg: Record<string, string> | undefined): string[] {
  if (!cfg) return [];
  const keys = Object.keys(cfg).filter((k) => /^report_footer_line\d+$/i.test(k));
  keys.sort((a, b) => {
    const na = parseInt(a.match(/\d+/)![0], 10);
    const nb = parseInt(b.match(/\d+/)![0], 10);
    return na - nb;
  });
  const lines: string[] = [];
  for (const k of keys) {
    const raw = (cfg[k] ?? "").toString().trim();
    if (!raw) continue;
    raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => lines.push(s));
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
  let y = 0,
    m = 0,
    d = 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yy, mm, dd] = s.split("-").map(Number);
    y = yy;
    m = mm;
    d = dd;
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [mm, dd, yy] = s.split("/").map(Number);
    y = yy;
    m = mm;
    d = dd;
  } else {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      y = dt.getFullYear();
      m = dt.getMonth() + 1;
      d = dt.getDate();
    }
  }
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const yy2 = String(y).slice(-2);
  return `${pad2(m)}/${pad2(d)}/'${yy2}`;
}

function getSignersFromConfig(cfg: Record<string, string>) {
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
    ? [
        {
          role: "Pathologist",
          name: pathoName,
          license: (cfg.patho_license || "").trim(),
          sig: (cfg.patho_signature_url || "").trim(),
        },
      ]
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
    const day = isDMY ? a : b;
    return new Date(y, month, day).getTime();
  }
  return 0;
}

type ReportViewerProps = {
  initialPatientId?: string;
  apiPath?: string;
  autoFetch?: boolean;
  useSession?: boolean;
  sessionPatientId?: string; // optional, when parent already knows the session PID

  // NEW (optional, non-breaking):
  headerOverride?: ReactNode; // custom header JSX from parent
  watermarkSizePx?: number; // e.g., 320 (overrides size for screen/print)
  watermarkOpacity?: number; // e.g., 0.05 (applies to screen & print)
  emitReportCount?: boolean; // emits window event with report count when loaded
};

export default function ReportViewer(props: ReportViewerProps) {
  const {
    initialPatientId,
    apiPath = "/api/patient-results",
    autoFetch = false,
    useSession = false, // if true, hides patient ID input (expects session to provide it)
    sessionPatientId = "",

    // NEW overrides
    headerOverride,
    watermarkSizePx,
    watermarkOpacity,
    emitReportCount = false,
  } = props;

  const searchParams = useSearchParams();
  const searchPatientId = useMemo(() => {
    if (!searchParams) return "";
    const raw = (searchParams.get("patient_id") || searchParams.get("pid") || "").trim();
    return raw ? raw.toUpperCase() : "";
  }, [searchParams]);

  const normalizedInitialId = (initialPatientId || "").trim();
  const normalizedSessionId = (sessionPatientId || "").trim();

  const [patientId, setPatientId] = useState(
    normalizedInitialId || normalizedSessionId || searchPatientId,
  );

  useEffect(() => {
    const next = searchPatientId || normalizedInitialId || normalizedSessionId || "";
    if (next && next !== patientId) setPatientId(next);
  }, [searchPatientId, normalizedInitialId, normalizedSessionId, patientId]);

  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [bootCfg, setBootCfg] = useState<Record<string, string> | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const summaryPanelId = useId();
  // Splash / preload states
  const [bootLoaded, setBootLoaded] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [watermarkLoaded, setWatermarkLoaded] = useState(false);
  const [splashTimedOut, setSplashTimedOut] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (!ignore && json?.config) setBootCfg(json.config as Record<string, string>);
        }
      } catch {
      } finally {
        if (!ignore) setBootLoaded(true);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const cfg = { ...(bootCfg || {}), ...(data?.config || {}) } as Record<string, string>;
  const reports = data?.reports ?? [];
  const patientOnly = data?.patientOnly === true;

  // Dashboard footer visibility toggles
  const showFooterOnDashboard = (cfg?.footer_show_on_dashboard || "").toLowerCase() === "true";
  const showSignersOnDashboard =
    (cfg?.footer_show_signers_on_dashboard || "").toLowerCase() === "true";
  const hasReport = (reports?.length ?? 0) > 0;
  const hasLabSections = useMemo(
    () =>
      reports.some(
        (r: any) =>
          Array.isArray(r?.sections) && r.sections.some((s: any) => (s?.items?.length ?? 0) > 0),
      ),
    [reports],
  );
  const showFooter = hasLabSections && (hasReport || showFooterOnDashboard);
  const showSigners = hasLabSections && (hasReport || showSignersOnDashboard);

  // Footer + style knobs
  const footerLines = getFooterLines(cfg);
  const footerAlign = (cfg?.report_footer_align ?? "center").toString().toLowerCase() as
    | "left"
    | "center"
    | "right";
  const footerFontPx = Number(cfg?.report_footer_font_px) || 10;
  const footerGapPx = Number(cfg?.report_footer_gap_px) || 4;

  // Watermark config
  const { primary: wmPrimary, fallback: wmFallback } = driveImageUrls(cfg?.watermark_image_url);
  const wmImgUrl = wmPrimary || wmFallback;

  const wmShowScreen = (cfg?.watermark_show_dashboard || "true").toLowerCase() === "true";
  const wmShowPrint = (cfg?.watermark_show_print || "true").toLowerCase() === "true";
  const wmOpacityScreen = Math.max(0, Math.min(1, Number(cfg?.watermark_opacity_screen || 0.12)));
  const wmOpacityPrint = Math.max(0, Math.min(1, Number(cfg?.watermark_opacity_print || 0.08)));
  const wmAngleDeg = Number(cfg?.watermark_angle_deg || -30);
  const wmSize = cfg?.watermark_size || "40vw";

  // --- Prop overrides (optional) ---
  const wmSizeEffective = typeof watermarkSizePx === "number" ? `${watermarkSizePx}px` : wmSize;

  const wmOpacityScreenEffective =
    typeof watermarkOpacity === "number" ? watermarkOpacity : wmOpacityScreen;

  const wmOpacityPrintEffective =
    typeof watermarkOpacity === "number" ? watermarkOpacity : wmOpacityPrint;

  const showVisitNotes = (cfg?.show_visit_notes || "").toLowerCase() === "true";

  // Visits
  const visitDates = useMemo(() => {
    const dates = Array.from(
      new Set(reports.map((r: any) => String(r?.visit?.date_of_test ?? "")).filter(Boolean)),
    ).sort((a, b) => ts(b) - ts(a)); // ← real date sort
    return dates;
  }, [reports]);

  const report = useMemo(() => {
    if (!Array.isArray(reports) || reports.length === 0) return undefined;
    const current = selectedDate || (visitDates[0] ?? "");
    return reports.find((r: any) => (r?.visit?.date_of_test ?? "") === current) || reports[0];
  }, [reports, selectedDate, visitDates]);
  const showNoLabsNotice = (patientOnly || !hasLabSections) && !!report;

  function emitReportCountEvent(pid: string, count: number) {
    if (!emitReportCount || typeof window === "undefined") return;
    const normalized = String(pid || "").trim();
    if (!normalized) return;
    window.dispatchEvent(
      new CustomEvent("reportviewer:loaded", {
        detail: { patientId: normalized, count },
      }),
    );
  }

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
        try {
          text = await res.text();
        } catch {}
      }

      if (!res.ok) {
        const msg = json?.error || text || `Request failed (${res.status})`;
        setErr(msg);
        setData(null);
        setSelectedDate("");
        return;
      }

      const reports: any[] =
        (Array.isArray(json?.reports) && json.reports) ||
        (Array.isArray(json?.rows) && json.rows) ||
        (Array.isArray(json?.data) && json.data) ||
        [];

      if (reports.length === 0) {
        if (emitReportCount) emitReportCountEvent(id, 0);
        setErr("No matching patient ID, please try again.");
        setData(null);
        setSelectedDate("");
        return;
      }

      const payload: ReportResponse = { count: reports.length, reports };
      if (json?.config && typeof json.config === "object") {
        payload.config = json.config as Record<string, string>;
      }
      if (typeof json?.patientOnly === "boolean") {
        payload.patientOnly = json.patientOnly;
      }
      setData(payload);

      const dates: string[] = Array.from(
        new Set<string>(
          reports.map((r: any) => String(r?.visit?.date_of_test ?? "")).filter(Boolean),
        ),
      ).sort((a: string, b: string) => ts(b) - ts(a));
      if (emitReportCount) {
        const count = dates.length || reports.length;
        emitReportCountEvent(id, count);
      }
      setSelectedDate(dates[0] ?? "");
    } catch (e: any) {
      setErr(e?.message || "Network error.");
      setData(null);
      setSelectedDate("");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSessionReports() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: "GET", // session derives patient_id; GET is fine
        cache: "no-store",
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
        try {
          text = await res.text();
        } catch {}
      }

      if (!res.ok) {
        const msg = json?.error || text || `Request failed (${res.status})`;
        setErr(msg);
        setData(null);
        setSelectedDate("");
        return;
      }

      const reports: any[] =
        (Array.isArray(json?.reports) && json.reports) ||
        (Array.isArray(json?.rows) && json.rows) ||
        (Array.isArray(json?.data) && json.data) ||
        [];

      if (reports.length === 0) {
        if (emitReportCount) {
          const pid = (patientId || normalizedSessionId || searchPatientId).trim();
          emitReportCountEvent(pid, 0);
        }
        setErr("No reports found.");
        setData(null);
        setSelectedDate("");
        return;
      }

      const payload: ReportResponse = { count: reports.length, reports };
      if (json?.config && typeof json.config === "object") {
        payload.config = json.config as Record<string, string>;
      }
      if (typeof json?.patientOnly === "boolean") {
        payload.patientOnly = json.patientOnly;
      }
      setData(payload);

      const dates: string[] = Array.from(
        new Set<string>(
          reports.map((r: any) => String(r?.visit?.date_of_test ?? "")).filter(Boolean),
        ),
      ).sort((a: string, b: string) => ts(b) - ts(a));
      if (emitReportCount) {
        const pid = (patientId || normalizedSessionId || searchPatientId).trim();
        const count = dates.length || reports.length;
        emitReportCountEvent(pid, count);
      }
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
    if (!autoFetch) return;
    const effectivePatientId = (patientId || normalizedSessionId || searchPatientId).trim();
    if (useSession) {
      if (effectivePatientId) {
        // Prefer an explicit patient ID to avoid relying on mixed-role cookies
        fetchReports(effectivePatientId);
      } else {
        fetchSessionReports();
      }
    } else if (effectivePatientId) {
      fetchReports(effectivePatientId);
    }
  }, [autoFetch, useSession, patientId, normalizedSessionId, searchPatientId, apiPath]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) setSummaryOpen(false);
  }, []);

  // Build index for previous values
  const valueIndex = useMemo(() => {
    const map = new Map<string, Map<string, { raw: string; num: number | null; unit?: string }>>();
    for (const r of reports) {
      const d = r.visit.date_of_test;
      let m = map.get(d);
      if (!m) {
        m = new Map();
        map.set(d, m);
      }
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

  function findPrevListAny(
    it: ReportItem,
    maxCount = 3,
  ): Array<{ date: string; raw: string; num: number | null; unit?: string }> {
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
          reports.map((r: any) => String(r?.visit?.date_of_test ?? "")).filter(Boolean),
        ),
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
    if (!logoSrc) {
      setLogoLoaded(true);
      return;
    }
    const img = new Image();
    img.onload = img.onerror = () => setLogoLoaded(true);
    img.src = logoSrc;
  }, [logoSrc]);

  // Watermark resolves to the explicit watermark image if set, otherwise falls back to the logo.
  const watermarkSrc = wmImgUrl || logoSrc;
  const watermarkFallback = wmImgUrl ? wmFallback : logoFallback;
  const hasWm = Boolean(watermarkSrc);

  useEffect(() => {
    setWatermarkLoaded(false);
    if (!watermarkSrc) {
      setWatermarkLoaded(true);
      return;
    }
    const img = new Image();
    img.onload = img.onerror = () => setWatermarkLoaded(true);
    img.src = watermarkSrc;
  }, [watermarkSrc]);

  // Splash control
  const splashEnabled = (cfg?.loading_splash_enabled ?? "true").toString().toLowerCase() === "true";
  const splashMaxMs = Number(cfg?.loading_splash_max_ms ?? 900);
  const waitingForAssets = !bootLoaded || !logoLoaded || !watermarkLoaded;
  const waitingForData = loading;

  useEffect(() => {
    if (!splashEnabled) {
      setSplashTimedOut(false);
      return;
    }
    if (!waitingForAssets) {
      setSplashTimedOut(false);
      return;
    }
    const t = setTimeout(() => setSplashTimedOut(true), splashMaxMs);
    return () => clearTimeout(t);
  }, [splashEnabled, waitingForAssets, splashMaxMs]);

  const showSplash = splashEnabled && ((waitingForAssets && !splashTimedOut) || waitingForData);
  const showInlineLoader = !showSplash && loading && !report;

  return (
    <div className="page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        :root{
          --font-base: 14px;
          --font-heading: 18px;
          --font-title: 18px;
          --row-pad: 6px;
          --sig-height: 30px;
          --logo-height: 150px;
          --brand: #16313b;
          --accent: #44969b;
          --border: #d5e0e8;
          --border-strong: #8ba1ae;
          --surface: #ffffff;
          --surface-muted: #ffffff;
          --shell-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        }
        body {
          font-size: var(--font-base);
          color: var(--brand);
        }
        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--surface-muted);
          padding: clamp(12px, 4vw, 32px);
        }
        h1 { font-size: var(--font-title); }
        h3 { font-size: var(--font-heading); }

        .container { max-width: 960px; margin: 0 auto; }
        .viewer-shell {
          padding: clamp(18px, 4vw, 26px);
          background: var(--surface);
          border: 1px solid rgba(25, 82, 102, 0.08);
          border-radius: 24px;
          box-shadow: var(--shell-shadow);
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-bottom: clamp(26px, 5vw, 48px);
        }
        .content { flex: 1 0 auto; }
        .viewer-footer {
          margin-top: clamp(28px, 5vw, 52px);
          padding: clamp(18px, 4vw, 26px);
          background: var(--surface);
          border: 1px solid rgba(25, 82, 102, 0.08);
          border-radius: 20px;
          box-shadow: var(--shell-shadow);
        }
        .viewer-footer .sig-row { margin-top: 4px; }
        th, td { padding: calc(var(--row-pad) - 1px) 10px; }

        .date-select {
          font-size: 16px;
          padding: 8px 12px;
          min-height: 44px;
          line-height: 1.25;
          border: 1px solid rgba(25,82,102,0.22);
          border-radius: 12px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.06), 0 0 0 3px rgba(15,118,110,0.08);
          background: linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);
          appearance: none;
          padding-right: 44px;
          transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }
        .date-select:focus {
          transform: translateY(-1px);
          outline: none;
          border-color: rgba(15,118,110,0.65);
          box-shadow: 0 12px 20px rgba(15,118,110,0.15), 0 0 0 3px rgba(15,118,110,0.22);
        }
        .date-select option { font-size: 15px; }
        .controls .label {
          font-weight: 700;
          color: var(--brand);
        }

        /* clinic header */
        .clinic {
          display:flex;
          align-items:center;
          gap:12px;
          margin: 4px 0 12px 0;
          padding: 12px 16px;
          border-radius: 20px;
          border: 1px solid rgba(25,82,102,0.08);
          background: rgba(244,247,251,0.7);
        }
        .clinic img { height: var(--logo-height); width:auto; object-fit: contain; display:block; }
        .clinic-name { font-weight: 700; font-size: 20px; line-height: 1.2; color: #0f1f28; }
        .clinic-sub { color: rgba(41,74,86,0.78); }

        /* SCREEN: title + search on ONE line, centered */
        .toolbar{
          display:flex;
          align-items:center;
          justify-content:center;   /* center the whole group */
          gap:12px;
          margin:12px auto 14px;
          width:100%;
          flex-wrap:nowrap;         /* keep on one line */
        }
        .toolbar h1{
          margin:0;
          flex:0 0 auto;            /* don't stretch; keep content width */
        }
        .toolbar .searchbar{
          flex:0 0 auto;            /* don't stretch; keep content width */
        }

        /* keep the searchbar centered too */
        .searchbar{
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
        }

        /* patient header (name, sex/age/DOB) */
        .patient-head {
          display:flex; align-items:baseline; justify-content:space-between;
          gap:12px; padding:14px 16px; margin: 0;
          border:1px solid rgba(25,82,102,0.12); border-radius:20px;
          background: linear-gradient(180deg, rgba(255,255,255,0.9), #ffffff 90%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
        }
        .ph-name { font-size: 20px; font-weight: 800; letter-spacing: .2px; }
        .ph-meta { color:rgba(41,74,86,0.75); word-break: break-word; }

        /* controls row */
        .controls { display:flex; gap:12px; margin:8px 0 12px; flex-wrap:wrap; }
        .control-card{
          flex-basis: 100%;
          display:flex;
          align-items:center;
          gap:12px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(25,82,102,0.12);
          background: rgba(244,247,251,0.65);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px rgba(15,23,42,0.04);
        }
        .control-count{
          font-weight: 700;
          color: var(--brand);
          letter-spacing: 0.01em;
        }
        .control-select{
          flex:1 1 auto;
          min-width:0;
          display:flex;
          align-items:center;
          gap:10px;
          position: relative;
        }
        .control-select .label{
          font-size: 15px;
          white-space: nowrap;
          color: var(--border-strong);
        }
        .control-select::after{
          content:"";
          position:absolute;
          top:50%;
          right:16px;
          width:10px;
          height:10px;
          border-right:2px solid var(--border-strong);
          border-bottom:2px solid var(--border-strong);
          transform: translateY(-55%) rotate(45deg);
          pointer-events:none;
          transition: transform .2s ease, border-color .2s ease;
        }
        .control-select:focus-within::after{
          transform: translateY(-15%) rotate(225deg);
          border-color: rgba(15,118,110,0.8);
        }
        .control-toggle {
          display:flex;
          align-items:center;
          gap:6px;
          color: var(--brand);
        }
        .control-row {
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
        }
        .control-row button {
          display:flex;
          align-items:center;
          justify-content:center;
          gap:6px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(25,82,102,0.16);
          background: linear-gradient(135deg, rgba(15,118,110,0.12), rgba(15,118,110,0.05));
          color: var(--brand);
          font-weight: 600;
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .control-row button:hover{
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(15,118,110,0.18);
        }
        .control-row button:active{
          transform: translateY(0);
          box-shadow: none;
        }

        /* footer */
        .report-footer { margin-top: auto; padding-top: 6px; border-top: none; font-size: 14px; color: var(--brand); }
        .sig-row {
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap:16px;
          align-items:start;
          justify-items:center;
        }
        .sig {
          min-width:0;
          text-align:center;
          padding:10px 8px 12px;
          margin-top:0;
          width: 100%;
          border-radius: 18px;
          border: 1px solid rgba(25,82,102,0.08);
          background: rgba(244,247,251,0.7);
        }
        .sig img { max-height: var(--sig-height); width: auto; object-fit: contain; display:block; margin: 6px auto 6px; }
        .muted { color:rgba(21,44,54,0.68); font-size: 12px; }

        table { width:100%; border-collapse: collapse; }
        thead th {
          border-bottom: 1px solid rgba(25,82,102,0.18);
          background: rgba(244,247,251,0.6);
          color: rgba(21,44,54,0.82);
          font-weight: 600;
        }
        tbody tr:nth-child(odd) {
          background: rgba(244,247,251,0.45);
        }
        tbody td { border-bottom: 1px solid rgba(15,23,42,0.04); }
        .flag-cell { text-align: left !important; }
        .flag-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 10px;
          border-radius: 999px;
          background: rgba(21,44,54,0.08);
          color: rgba(21,44,54,0.85);
          letter-spacing: 0.02em;
        }
        .flag-pill::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.75;
        }
        .flag-pill[data-flag="H"] {
          background: rgba(220,38,38,0.16);
          color: #b00020;
        }
        .flag-pill[data-flag="L"] {
          background: rgba(14,116,144,0.18);
          color: #0f766e;
        }
        .flag-pill[data-flag="A"] {
          background: rgba(234,179,8,0.2);
          color: #b45309;
        }
        .flag-pill[data-flag=""] {
          background: rgba(148,163,184,0.2);
          color: #475569;
        }
        .section-block {
          border: 1px solid rgba(25,82,102,0.08);
          border-radius: 20px;
          padding: 18px 18px 12px;
          background: rgba(255,255,255,0.98);
          box-shadow: 0 18px 38px rgba(15,23,42,0.06);
        }
        .section-block h3 {
          margin: 0 0 12px 0;
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .table-scroll table {
          min-width: 560px;
        }
        /* Compact tables (e.g., Urinalysis/Fecalysis) don't need the wide min-width or stickies. */
        .table-scroll[data-compact="true"] {
          overflow-x: visible;
        }
        .table-scroll[data-compact="true"] table {
          min-width: 0;
        }
        .table-scroll[data-compact="true"] table th:first-child,
        .table-scroll[data-compact="true"] table td:first-child {
          position: static;
          background: inherit;
          border-right: 1px solid rgba(148,163,184,0.18);
        }
        .table-scroll table th:first-child,
        .table-scroll table td:first-child {
          position: sticky;
          left: 0;
          z-index: 2;
          background: #ffffff;
          border-right: 1px solid rgba(148,163,184,0.18);
        }
        .table-scroll table thead th:first-child {
          background: rgba(244,247,251,0.6);
        }
        .table-scroll table tbody tr:nth-child(odd) td:first-child {
          background: rgba(244,247,251,0.45);
        }

        @media (max-width: 900px) {
          :root{
            --font-base: 13.5px;
            --font-heading: 17px;
            --font-title: 17px;
            --row-pad: 5px;
            --logo-height: 130px;
            --sig-height: 26px;
          }
          .viewer-shell,
          .viewer-footer {
            padding: clamp(16px, 3vw, 22px);
            border-radius: 20px;
          }
          .container { padding-inline: 14px; }
          .clinic { flex-direction: column; align-items: center; text-align: center; }
          .clinic img { height: auto; max-height: 120px; max-width: min(80%, 240px); }
          .patient-head { flex-direction: column; align-items: flex-start; gap: 6px; }
          .ph-name { font-size: 18px; }
          .ph-meta { font-size: 13px; line-height: 1.4; }
          .controls { flex-direction: column; align-items: stretch; gap: 12px; }
          .control-card{ flex-direction: column; align-items: flex-start; gap: 8px; }
          .control-count{ font-size: 13.5px; }
          .control-toggle { width: 100%; }
          .control-select{
            width: 100%;
            flex-direction: column;
            align-items: stretch;
            gap:6px;
          }
          .control-select .label{
            font-size: 14px;
          }
          .control-row { width: 100%; }
          .control-row select {
            flex: 1 1 auto;
            min-width: 0;
          }
          .date-select {
            font-size: 15px;
            padding: 8px 10px;
            min-height: 40px;
          }
          .report-footer { font-size: 12.5px; padding-top: 18px; }
          .sig-row {
            grid-template-columns: repeat(auto-fit, minmax(160px,1fr));
            gap:12px;
          }
          .sig { width: 100%; padding-top:4px; }
          .sig img { max-height: 22px; }
          .ps-card { padding: 12px; }
          .ps-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
          .section-block {
            padding: 16px 16px 12px;
            border-radius: 18px;
          }
        }

        @media (max-width: 560px) {
          .toolbar{ flex-direction:wrap; }
          :root{
            --font-base: 12.8px;
            --font-heading: 15px;
            --font-title: 15px;
            --row-pad: 4px;
            --sig-height: 22px;
          }
          .viewer-shell,
          .viewer-footer {
            padding: 16px;
            border-radius: 16px;
          }
          .container { padding-inline: 12px; }
          .control-card{ gap: 6px; }
          .control-count{ font-size: 13px; }
          .control-row {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .control-select{
            gap:4px;
          }
          .control-select .label{
            font-size: 13.5px;
          }
          .control-row select,
          .control-row button {
            width: 100%;
          }
          .date-select {
            font-size: 14.5px;
            padding: 8px 10px;
            min-height: 38px;
          }
          .table-scroll table {
            min-width: 520px;
          }
          .section-block {
            padding: 14px 14px 10px;
            border-radius: 16px;
          }
        }

        /* Utility: print-only/screen-only (no Tailwind dependency) */
        .print-only { display: none; }
        .screen-only { display: block; }

        @media print {
          /* ==== A5 portrait setup ==== */
          @page { size: A5 portrait; margin: 10mm; }

          :root{
            --font-base: 11px;
            --font-heading: 13px;
            --font-title: 13px;
            --row-pad: 4px;
            --sig-height: 22px;
            --logo-height: 64px;
          }

          body { margin: 0; font-size: var(--font-base); }

          .page { padding: 0 !important; background: #fff !important; }
          .container { max-width: none; padding: 0; margin: 0; }
          .viewer-shell,
          .viewer-footer {
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .toolbar, .controls { display:none !important; }
          .clinic { margin: 0 0 6px 0; text-align: center; background: #fff !important; border: none !important; }
          .clinic img { max-height: 64px !important; }
          h3 { margin: 6px 0; break-after: avoid-page; }

          /* Allow splitting to avoid large white gaps */
          .section-block { break-inside: auto !important; page-break-inside: auto !important; }
          table { page-break-inside: auto !important; }
          thead { display: table-header-group !important; }   /* repeat headers on new page */
          tfoot { display: table-footer-group !important; }
          tr, td, th { page-break-inside: avoid; }  
          .table-scroll { overflow: visible !important; }
          .table-scroll table { min-width: 0 !important; }

          /* Footer/signers shouldn’t split */
          .report-footer { page-break-inside: avoid; }

          /* Hide Patient Summary Card on print */
          .ps-card { display: none !important; }

          /* Utilities */
          .print-only { display: block !important; }
          .screen-only { display: none !important; }

          /* PRINT — force smaller footer and signatures (overrides inline with !important) */
          .footer-lines { font-size: 8px !important; line-height: 1.15 !important; }   /* footer text */
          .report-footer { margin-top: 10px !important; }                               /* breathing room */

          .sig-row{
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
            gap: 4px 10px !important;
            justify-items: center !important;
          }
          .sig{
            text-align: center !important;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
          }
          .sig img{ max-height: 12px !important; margin: 0 0 2px 0 !important; }
          .sig strong{ font-size: 10.5px !important; line-height: 1.15 !important; }
          .muted{ font-size: 9.5px !important; line-height: 1.15 !important; }
        }

        @media print {
          /* ==== A5 portrait + compact sizing ==== */
          @page { size: A5 portrait; margin: 6mm; }

          :root{
            --font-base: 11px;
            --font-heading: 13px;
            --font-title: 13px;
            --row-pad: 3px;
            --sig-height: 22px;
            --logo-height: 64px;
          }

          body { margin: 0; font-size: var(--font-base); }

          .page { display: block !important; min-height: auto !important; padding: 0 !important; background: #fff !important; }
          .container { max-width: none; padding: 0 !important; margin: 0 !important; }
          .viewer-shell,
          .viewer-footer {
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }

          /* Hide on print */
          .toolbar, .controls { display: none !important; }
          .print-hide { display: none !important; }
          .screen-only { display: none !important; }

          /* Show on print */
          .print-only { display: block !important; }

          /* Header compaction */
          .clinic { margin: 0 0 6px 0; text-align: center; background: #fff !important; border: none !important; }
          .clinic img   { max-height: 54px !important; }
          .clinic-name  { font-size: 14px !important; line-height: 1.15; }

          /* White paper look ONLY on print */
          html, body, main, #__next,
          .page, .container, .content,
          section, article,
          table, thead, tbody, tr, th, td {
            background: #fff !important;
          }
          /* strip card/border look */
          .page, .container, .content, section,
          .card, .panel, .box, .patient-head, .ps-card, .report-footer, .viewer-shell, .viewer-footer, .section-block, table {
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
          }

          /* keep subtle table lines (OPTIONAL) */
          table thead th { border-bottom: 1px solid rgba(0,0,0,0.08) !important; }
          table tbody td { border-bottom: 1px solid rgba(0,0,0,0.06) !important; }

          /* Allow content to split across pages (avoid big white gaps) */
          .section-block { break-inside: auto !important; page-break-inside: auto !important; margin-bottom: 8px !important; }
          table { page-break-inside: auto !important; margin-bottom: 6px !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tr, td, th { page-break-inside: avoid; }
          .table-scroll { overflow: visible !important; }
          .table-scroll table { min-width: 0 !important; }

          /* Hide Patient Summary on print */
          .ps-card { display: none !important; }

          /* Footer & signatures: smaller, centered, 2 columns */
          .report-footer { page-break-inside: avoid; margin-top: 10px !important; line-height: 1.2 !important; }
          .footer-lines  { font-size: 8.5px !important; line-height: 1.15 !important; }

          .sig-row{
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
            gap: 4px 10px !important;
            align-items: end !important;
            justify-items: center !important;
          }
          .sig{
            min-width: 0 !important;
            margin-top: 0 !important;
            text-align: center !important;
          }
          .sig img{ max-height: 12px !important; margin: 0 0 2px 0 !important; }
          .sig strong{ font-size: 10.5px !important; line-height: 1.15 !important; }
          .muted{ font-size: 9.5px !important; line-height: 1.15 !important; }

          /* PRINT: a little more space above footer/signatures */
            table{ margin-bottom: 12px !important; }         /* was 6px */
            .section-block{ margin-bottom: 12px !important; }/* was 8px */
            .report-footer{ margin-top: 14px !important; }   /* more air */

            /* PRINT: signatures perfectly centered under names */
            .sig-row{
              display:grid !important;
              grid-template-columns: repeat(2, minmax(0,1fr)) !important;
              column-gap:12px !important;
              row-gap:6px !important;
              justify-items:center !important;  /* centers each signer block */
              align-items:end !important;
            }
            .sig{
              display:flex !important;
              flex-direction:column !important;
              align-items:center !important;    /* centers image + text */
              text-align:center !important;
              min-width:0 !important;
              margin-top:0 !important;
            }
            .sig img{
              display:block !important;
              max-height:12px !important;
              margin:0 0 4px 0 !important;      /* small gap above the name */
            }
            .sig strong{ font-size:10.5px !important; line-height:1.15 !important; }
            .muted{      font-size: 9.5px !important; line-height:1.15 !important; }
        }


        /* --- Watermark layer --- */
        .page { position: relative; }
        .page > * { position: relative; z-index: 1; }
        .wm-layer { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
        .wm-img { width: var(--wm-size, 60vw); height: auto; opacity: var(--wm-opacity, 0.06); transform: rotate(var(--wm-angle, -30deg)); }
        @media print {
          .wm-layer { display: flex !important; }
          .wm-layer[data-print="off"] { display: none !important; }
          .wm-img { opacity: var(--wm-opacity-print, 0.08); }
        }

        /* Splash overlay */
        .splash { position: fixed; inset: 0; display: grid; place-items: center; background: #fff; z-index: 9999; opacity: 1; transition: opacity .2s ease; }
        .splash-inner { text-align: center; display: grid; gap: 10px; }
        .splash-text { font-size: 14px; color: #666; }
        .splash-dot { width: 6px; height: 6px; border-radius: 9999px; background: #222; margin: 6px auto 0; animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { transform: scale(0.8); opacity: .4; } 50% { transform: scale(1.3); opacity: 1; } }

        /* Patient Summary Card (screen only by default) */
        .ps-card { border: 1px solid rgba(25,82,102,0.12); border-radius: 20px; padding: 16px; margin: 8px 0 8px; background: rgba(244,247,251,0.65); backdrop-filter: blur(4px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.45); }
        .ps-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; flex-wrap:wrap; }
        .ps-title { font-weight: 700; font-size: 15px; color: var(--brand); }
        .ps-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .ps-badge { font-size:11px; color:#526673; background:#fff; border:1px solid rgba(25,82,102,0.16); border-radius:999px; padding:3px 10px; box-shadow:0 4px 12px rgba(15,23,42,0.08); }
        .ps-toggle { border:1px solid rgba(25,82,102,0.18); background:#fff; color:var(--brand); font-size:12px; font-weight:600; padding:5px 10px; border-radius:999px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 10px rgba(15,23,42,0.08); transition:transform .15s ease, box-shadow .15s ease; }
        .ps-toggle svg { width:12px; height:12px; transition: transform .2s ease; }
        .ps-card.is-open .ps-toggle svg { transform: rotate(180deg); }
        .ps-toggle:hover{ transform: translateY(-1px); box-shadow:0 6px 12px rgba(15,23,42,0.12); }
        .ps-toggle:active{ transform: translateY(0); box-shadow:none; }
        .ps-collapsed-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
        .ps-chip { font-size:11.5px; color:#356072; background:#fff; border:1px solid rgba(25,82,102,0.15); border-radius:999px; padding:4px 9px; box-shadow:0 3px 8px rgba(15,23,42,0.08); }
        .ps-body { overflow:hidden; transition:max-height .28s ease, opacity .18s ease; }
        .ps-body.open { max-height: 1200px; opacity:1; }
        .ps-body.collapsed { max-height: 0; opacity:0; pointer-events:none; }
        .ps-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 10px 16px; padding-top:2px; }
        .ps-label { color:#637685; font-size:12px; text-transform:uppercase; letter-spacing:0.03em; }
        .ps-value { font-weight:600; color:var(--brand); }
        .ps-multi { white-space:pre-wrap; line-height:1.25; }
        .ps-pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid rgba(25,82,102,0.18); background:#fff; color:var(--brand); }
        .ps-sep { grid-column:1 / -1; height:1px; background:#d7e4ec; margin:6px 0; opacity:0.7; }

        /* Inline loading panel (after header) */
        .panel-loader{
          margin: 14px 0;
          padding: 26px;
          border-radius: 16px;
          border: 1px solid rgba(25,82,102,0.08);
          background: linear-gradient(180deg, #ffffff 0%, #f6fbff 100%);
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 8px;
          place-items: center;
          color: #2c5566;
          text-align: center;
        }
        .loader-dots{
          display:flex;
          gap:8px;
        }
        .loader-dots span{
          width:10px;
          height:10px;
          border-radius:999px;
          background:#44969b;
          opacity:0.25;
          animation: loader-pulse 1s ease-in-out infinite;
        }
        .loader-dots span:nth-child(2){ animation-delay: .12s; }
        .loader-dots span:nth-child(3){ animation-delay: .24s; }
        @keyframes loader-pulse { 0%, 100% { transform: translateY(1px); opacity: .25; } 50% { transform: translateY(-4px); opacity: 1; } }
        
      `}</style>

      {showSplash && (
        <div className="splash">
          <div className="splash-inner">
            {logoSrc ? (
              <img src={logoSrc} alt="" referrerPolicy="no-referrer" style={{ maxHeight: 72 }} />
            ) : null}
            <div className="splash-text">
              {cfg?.loading_splash_text || "Loading WELLSERV® Portal…"}
            </div>
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
          {watermarkSrc ? (
            <img
              className="wm-img"
              src={watermarkSrc}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (watermarkFallback && img.src !== watermarkFallback) img.src = watermarkFallback;
                else img.style.display = "none";
              }}
              alt=""
            />
          ) : null}
        </div>
      )}

      <div
        className="container content viewer-shell"
        style={{ opacity: showSplash ? 0 : 1, pointerEvents: showSplash ? "none" : "auto" }}
      >
        {/* ---------- CLINIC HEADER (override-able) ---------- */}
        {headerOverride ? (
          <div className="mb-2">{headerOverride}</div>
        ) : (
          (cfg.clinic_name || cfg.clinic_logo_url || cfg.clinic_address || cfg.clinic_phone) && (
            <div
              className="clinic"
              style={{ flexDirection: "column", alignItems: "center", textAlign: "center" }}
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{ display: "block", margin: "0 auto", maxHeight: 120 }}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (logoFallback && img.src !== logoFallback) img.src = logoFallback;
                    else img.style.display = "none";
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
          <div className="toolbar screen-only">
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
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  width: 260,
                }}
              />
              <button
                onClick={() => fetchReports(patientId)}
                disabled={loading || !patientId.trim()}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #44969b",
                  background: "#44969b",
                  color: "#fff",
                }}
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

        {/* ---------- Patient Summary Card (hidden on print) ---------- */}
        {report &&
          (() => {
            const p: any = report.patient || {};
            const vitalsLatest = p.vitals?.latest || null;

            // Vitals & contact
            let htFt = p.height_ft;
            let htIn = p.height_inch;
            const ftInConverted = ftInFromCm(
              typeof vitalsLatest?.height_cm === "number"
                ? vitalsLatest.height_cm
                : num(vitalsLatest?.height_cm),
            );
            if (ftInConverted) {
              htFt = ftInConverted.ft;
              htIn = ftInConverted.inch;
            }

            const wtKg = vitalsLatest?.weight_kg ?? p.weight_kg;
            const systolic = vitalsLatest?.systolic_bp ?? p.systolic_bp;
            const diastolic = vitalsLatest?.diastolic_bp ?? p.diastolic_bp;
            const hr = vitalsLatest?.hr;
            const rr = vitalsLatest?.rr;
            const tempC = vitalsLatest?.temp_c;
            const o2sat = vitalsLatest?.o2sat;
            const vitalsTimestamp = formatVitalsTimestamp(vitalsLatest?.measured_at);
            const bmi = vitalsLatest?.bmi ?? bmiFromFtInKg(htFt, htIn, wtKg);
            const bpStr = systolic && diastolic ? `${systolic}/${diastolic} mmHg` : "";
            const smoking = suffixIfNumeric(p.smoking_hx, "packs/mo");
            const alcohol = suffixIfNumeric(p.alcohol_hx, "bottles/mo");

            const email = (p.email || "").trim();
            const phone = (p.contact || "").trim();
            const addr = (p.address || "").trim();

            // Narratives
            const chief = (p.chief_complaint || "").trim();
            const hpi = (p.present_illness_history || "").trim();
            const pmh = (p.past_medical_history || "").trim();
            const psh = (p.past_surgical_history || "").trim();
            const allergies = (p.allergies_text || "").trim();
            const medsText = (p.medications_current || p.medications || "").trim();
            const famHx = (p.family_hx || p.family_history || "").trim();

            const lastUpd = (p.last_updated || "").trim();

            const hasVitals =
              !!htFt ||
              !!htIn ||
              !!wtKg ||
              !!bmi ||
              !!bpStr ||
              !!smoking ||
              !!alcohol ||
              hr != null ||
              rr != null ||
              tempC != null ||
              o2sat != null ||
              !!vitalsTimestamp;
            const hasContact = !!email || !!phone || !!addr;
            const hasNarr =
              !!chief || !!hpi || !!pmh || !!psh || !!allergies || !!medsText || !!famHx;

            const collapsedHighlights: string[] = [];
            if (bpStr) collapsedHighlights.push(`BP ${bpStr}`);
            if (bmi != null) collapsedHighlights.push(`BMI ${bmi} ${bmiClass(bmi)}`);
            if (wtKg) collapsedHighlights.push(`Weight ${withUnit(wtKg, "kg")}`);
            if (vitalsTimestamp) collapsedHighlights.push(`Vitals @ ${vitalsTimestamp}`);
            if (smoking) collapsedHighlights.push(`Smoking ${smoking}`);
            if (alcohol) collapsedHighlights.push(`Alcohol ${alcohol}`);
            if (collapsedHighlights.length === 0 && email)
              collapsedHighlights.push(`Email ${email}`);
            const visibleHighlights = collapsedHighlights.slice(0, 3);

            if (!hasVitals && !hasContact && !hasNarr) return null;

            return (
              <section className={`ps-card ${summaryOpen ? "is-open" : "is-collapsed"}`}>
                <div className="ps-head">
                  <div className="ps-title">Patient Summary</div>
                  <div className="ps-actions">
                    {lastUpd && <div className="ps-badge">Last updated: {lastUpd}</div>}
                    <button
                      type="button"
                      className="ps-toggle"
                      onClick={() => setSummaryOpen((prev) => !prev)}
                      aria-expanded={summaryOpen}
                      aria-controls={summaryPanelId}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M4 6.5 8 10l4-3.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {summaryOpen ? "Hide details" : "Show details"}
                    </button>
                  </div>
                </div>

                {!summaryOpen && visibleHighlights.length > 0 && (
                  <div className="ps-collapsed-chips">
                    {visibleHighlights.map((txt, idx) => (
                      <span key={idx} className="ps-chip">
                        {txt}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={`ps-body ${summaryOpen ? "open" : "collapsed"}`}
                  id={summaryPanelId}
                  aria-hidden={!summaryOpen}
                >
                  <div className="ps-grid">
                    {/* VITALS */}
                    {(htFt || htIn) && (
                      <div>
                        <div className="ps-label">Height</div>
                        <div className="ps-value">{fmtFtIn(htFt, htIn)}</div>
                      </div>
                    )}
                    {!!wtKg && (
                      <div>
                        <div className="ps-label">Weight</div>
                        <div className="ps-value">{withUnit(wtKg, "kg")}</div>
                      </div>
                    )}
                    {bmi != null && (
                      <div>
                        <div className="ps-label">Calculated BMI</div>
                        <div className="ps-value">
                          {bmi} <span className="ps-pill">{bmiClass(bmi)}</span>
                        </div>
                      </div>
                    )}
                    {!!bpStr && (
                      <div>
                        <div className="ps-label">Latest Known Blood Pressure</div>
                        <div className="ps-value">{bpStr}</div>
                      </div>
                    )}
                    {hr != null && (
                      <div>
                        <div className="ps-label">Heart Rate</div>
                        <div className="ps-value">{withUnit(hr, "bpm")}</div>
                      </div>
                    )}
                    {rr != null && (
                      <div>
                        <div className="ps-label">Respiratory Rate</div>
                        <div className="ps-value">{withUnit(rr, "/min")}</div>
                      </div>
                    )}
                    {tempC != null && (
                      <div>
                        <div className="ps-label">Temperature</div>
                        <div className="ps-value">{withUnit(tempC, "°C")}</div>
                      </div>
                    )}
                    {o2sat != null && (
                      <div>
                        <div className="ps-label">O₂ Saturation</div>
                        <div className="ps-value">{withUnit(o2sat, "%")}</div>
                      </div>
                    )}
                    {vitalsTimestamp && (
                      <div>
                        <div className="ps-label">Last Vitals Recorded</div>
                        <div className="ps-value">{vitalsTimestamp}</div>
                      </div>
                    )}
                    {!!smoking && (
                      <div>
                        <div className="ps-label">Smoking History</div>
                        <div className="ps-value">{smoking}</div>
                      </div>
                    )}
                    {!!alcohol && (
                      <div>
                        <div className="ps-label">Alcohol History</div>
                        <div className="ps-value">{alcohol}</div>
                      </div>
                    )}

                    {/* CONTACT */}
                    {!!phone && (
                      <div>
                        <div className="ps-label">Contact Number</div>
                        <div className="ps-value">{phone}</div>
                      </div>
                    )}
                    {!!email && (
                      <div>
                        <div className="ps-label">Email</div>
                        <div className="ps-value">{email}</div>
                      </div>
                    )}
                    {!!addr && (
                      <div>
                        <div className="ps-label">Address</div>
                        <div className="ps-value ps-multi">{addr}</div>
                      </div>
                    )}

                    {hasContact && hasNarr && <div className="ps-sep" />}

                    {/* NARRATIVES */}
                    {!!chief && (
                      <div>
                        <div className="ps-label">Chief Complaint</div>
                        <div className="ps-value ps-multi">{chief}</div>
                      </div>
                    )}
                    {!!hpi && (
                      <div>
                        <div className="ps-label">Present Illness History</div>
                        <div className="ps-value ps-multi">{hpi}</div>
                      </div>
                    )}
                    {!!pmh && (
                      <div>
                        <div className="ps-label">Past Medical History</div>
                        <div className="ps-value ps-multi">{pmh}</div>
                      </div>
                    )}
                    {!!psh && (
                      <div>
                        <div className="ps-label">Past Surgical History</div>
                        <div className="ps-value ps-multi">{psh}</div>
                      </div>
                    )}
                    {!!allergies && (
                      <div>
                        <div className="ps-label">Allergies</div>
                        <div className="ps-value ps-multi">{allergies}</div>
                      </div>
                    )}
                    {!!medsText && (
                      <div>
                        <div className="ps-label">Medications</div>
                        <div className="ps-value ps-multi">{medsText}</div>
                      </div>
                    )}
                    {!!famHx && (
                      <div>
                        <div className="ps-label">Family History</div>
                        <div className="ps-value ps-multi">{famHx}</div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

        {/* Print-only Test date & branch (replaces Tailwind "hidden print:block") */}
        {(report?.visit?.date_of_test || report?.visit?.branch) && (
          <div className="print-only" style={{ margin: "12px 0 16px" }}>
            <div style={{ paddingTop: 8, fontSize: 12 }}>
              {report?.visit?.date_of_test && (
                <>
                  <span style={{ fontWeight: 600 }}>Test date:</span>{" "}
                  {formatTestDate(report.visit.date_of_test)}
                </>
              )}
              {report?.visit?.branch && (
                <>
                  {" "}
                  • <span style={{ fontWeight: 600 }}>Branch:</span> {report.visit.branch}
                </>
              )}
            </div>
          </div>
        )}

        {/* ---------- Controls: show ONLY after a report is loaded ---------- */}
        {report && (
          <div className="controls">
            {visitDates.length > 0 && (
              <div className="control-card" aria-live="polite">
                <div className="control-count">
                  {visitDates.length === 1
                    ? "1 visit available"
                    : `${visitDates.length} visits available`}
                </div>
                {visitDates.length > 1 && (
                  <label className="control-toggle">
                    <input
                      type="checkbox"
                      checked={compareOn}
                      onChange={(e) => setCompareOn(e.target.checked)}
                    />
                    Compare with prev. visit/s
                  </label>
                )}
              </div>
            )}

            {visitDates.length > 0 && (
              <div className="control-row">
                <div className="control-select">
                  <label className="label">Visit date:</label>
                  <select
                    value={selectedDate || ""}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="date-select"
                  >
                    {visitDates.map((d) => (
                      <option key={d} value={d}>
                        {formatTestDate(d)}
                      </option>
                    ))}
                  </select>
                </div>

                <button onClick={() => window.print()} className="screen-only">
                  Print / Save as PDF
                </button>
              </div>
            )}
          </div>
        )}

        {err && <div style={{ color: "#b00020", marginTop: 4 }}>{err}</div>}

        {showInlineLoader && (
          <div className="panel-loader" role="status" aria-live="polite">
            <div className="loader-dots" aria-hidden={true}>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div>Loading patient details and results…</div>
          </div>
        )}

        {showNoLabsNotice && !loading && (
          <div
            style={{
              marginTop: 12,
              padding: "12px 16px",
              borderRadius: 12,
              background: "#f8fafc",
              color: "#0f172a",
            }}
          >
            No laboratory results yet. Patient info and vitals are shown above.
          </div>
        )}

        {report && (
          <>
            {report.sections
              .filter((sec) => (sec?.items?.length ?? 0) > 0)
              .map((section) => {
                const hideRF = section.name === "Urinalysis" || section.name === "Fecalysis";

                return (
                  <div key={section.name} className="section-block">
                    <h3>{section.name}</h3>
                    {(() => {
                      const compactTable = hideRF && !compareOn; // e.g., Urinalysis/Fecalysis — fewer cols, avoid needless horizontal scroll
                      return (
                        <div
                          className="table-scroll"
                          data-compact={compactTable ? "true" : undefined}
                        >
                          <table>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left" }}>Parameter</th>
                                <th style={{ textAlign: "right" }}>Result</th>
                                {compareOn && <th style={{ textAlign: "right" }}>Prev. Res.</th>}
                                {compareOn && (
                                  <th style={{ textAlign: "right" }}>Latest % Change</th>
                                )}
                                <th style={{ textAlign: "left" }}>Unit</th>
                                {!hideRF && <th style={{ textAlign: "left" }}>Reference</th>}
                                {!hideRF && <th style={{ textAlign: "left" }}>Current Flag</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {section.items.map((it) => {
                                if (!it.value) return null;

                                const labelLc = String(it.label || "")
                                  .trim()
                                  .toLowerCase();
                                if (
                                  labelLc === "branch" ||
                                  labelLc === "created at" ||
                                  labelLc === "updated at"
                                ) {
                                  return null;
                                }

                                const refText = hideRF ? "" : formatRef(it.ref);
                                const cur = toNum(it.value);
                                const skipPrev = shouldExcludeFromPrev(it, cfg);
                                const prevList =
                                  compareOn && !skipPrev ? findPrevListAny(it, 3) : [];
                                const prev1Num =
                                  compareOn && !skipPrev ? findPrevNumForDelta(it) : null;
                                const isRemarkRow = labelLc.startsWith("remark");

                                let deltaText = "—";
                                let deltaColor = "#666";
                                if (cur != null && prev1Num) {
                                  const delta = cur - prev1Num.value;
                                  const pct =
                                    prev1Num.value !== 0 ? (delta / prev1Num.value) * 100 : null;
                                  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
                                  deltaText = `${arrow} ${delta > 0 ? "+" : ""}${fmt(delta)}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`;
                                  deltaColor =
                                    delta > 0 ? "#b00020" : delta < 0 ? "#1976d2" : "#666";
                                }

                                // For Remarks rows, span the description across the remaining columns
                                if (isRemarkRow) {
                                  const totalCols =
                                    3 + // parameter + result + unit
                                    (compareOn ? 2 : 0) + // prev + delta
                                    (!hideRF ? 2 : 0); // reference + flag
                                  const span = totalCols - 1; // all columns except the "Parameter" label cell
                                  return (
                                    <tr key={it.key}>
                                      <td>{it.label}</td>
                                      <td
                                        colSpan={span}
                                        style={{
                                          whiteSpace: "normal",
                                          textAlign: "left",
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        {String(it.value ?? "")}
                                      </td>
                                    </tr>
                                  );
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
                                          {prevList.length
                                            ? prevList.map((p) => (
                                                <div
                                                  key={p.date}
                                                  style={{
                                                    whiteSpace: "nowrap",
                                                    fontSize: 12,
                                                    lineHeight: 1.2,
                                                  }}
                                                >
                                                  {formatPrevDate(p.date)}:{" "}
                                                  {p.num != null ? fmt(p.num) : p.raw}
                                                </div>
                                              ))
                                            : "—"}
                                        </td>
                                        <td style={{ textAlign: "right", color: deltaColor }}>
                                          {deltaText}
                                        </td>
                                      </>
                                    )}

                                    <td>{it.unit || ""}</td>
                                    {!hideRF && <td>{refText}</td>}
                                    {!hideRF && (
                                      <td className="flag-cell">
                                        {it.flag ? (
                                          <span className="flag-pill" data-flag={it.flag}>
                                            {it.flag === "H"
                                              ? "High"
                                              : it.flag === "L"
                                                ? "Low"
                                                : it.flag === "A"
                                                  ? "Alert"
                                                  : it.flag}
                                          </span>
                                        ) : (
                                          ""
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
          </>
        )}
      </div>

      {showFooter && (
        <footer className="report-footer container viewer-footer">
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
                          if (fallback && img.src !== fallback) img.src = fallback;
                          else img.style.display = "none";
                        }}
                      />
                    ) : null}
                    <div>
                      <strong>{s.name}</strong>
                    </div>
                    <div className="muted">
                      {s.role}
                      {s.license ? ` – PRC ${s.license}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {footerLines.length > 0 && (
            <div
              className="footer-lines"
              style={{
                textAlign: footerAlign,
                marginTop: 10,
                lineHeight: 1.3,
                width: "100%",
                fontSize: `${footerFontPx}px`,
              }}
            >
              {footerLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    marginTop: i === 0 ? 0 : footerGapPx,
                    ...(i === 2 || i === 3 ? { color: "var(--accent)" } : {}),
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
function formatVitalsTimestamp(s?: string | null) {
  if (!s) return "";
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

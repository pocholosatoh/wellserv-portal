"use client";
import { useEffect, useMemo, useState } from "react";

// ---------- types ----------
type RefInfo = { low?: number; high?: number; normal_values?: string };
type ReportItem = { key:string; label:string; value:string; unit?:string; flag?:""|"L"|"H"|"A"; ref?: RefInfo };
type ReportSection = { name:string; items:ReportItem[] };
type Patient = { patient_id:string; full_name:string; age:string; sex:string; birthday:string; contact:string; address:string };
type Visit = { date_of_test:string; barcode:string; notes:string };
type Report = { patient:Patient; visit:Visit; sections:ReportSection[] };
type ReportResponse = { count:number; reports:Report[]; config?: Record<string,string> };

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

// parse a numeric string like "89.2" or "-1.5" (rejects "N/A", "Positive", etc.)
function toNum(s?: string): number | null {
  const t = String(s ?? "").replace(/,/g, "").trim();
  const m = t.match(/^[-+]?\d*\.?\d+$/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });


// Collect footer lines from cfg: report_footer_line1..N (supports multi-line cell values)
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
  // Accepts "YYYY-MM-DD" or "M/D/YYYY" (with or without leading zeros)
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
  return `${pad2(m)}/${pad2(d)}/'${yy2}`; // MM/DD/'YY
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

// If your sheet provides a Drive link or ID, return a direct image URL
function toImageUrl(url?: string) {
  if (!url) return "";
  const m = url.match(/[-\w]{25,}/); // crude Drive file-id find
  return m ? `https://drive.google.com/uc?export=view&id=${m[0]}` : url;
}

export default function Portal() {
  const [patientId, setPatientId] = useState("");
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [bootCfg, setBootCfg] = useState<Record<string, string> | null>(null);
  const [compareOn, setCompareOn] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!ignore && json?.config) {
          setBootCfg(json.config as Record<string, string>);
        }
      } catch {
        // silently ignore; page still works without preloaded config
      }
    })();
    return () => { ignore = true; };
  }, []);

  const cfg = { ...(bootCfg || {}), ...(data?.config || {}) } as Record<string,string>;
  const reports = data?.reports ?? [];

  // Dashboard footer visibility toggles (default: hidden until search)
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

  // Watermark config (text or image)
  const { primary: wmPrimary, fallback: wmFallback } = driveImageUrls(cfg?.watermark_image_url);
  const wmImgUrl = wmPrimary || wmFallback; // prefer primary, fallback to lh3 host
  const wmText = (cfg?.watermark_text || "").trim();
  const wmShowScreen = (cfg?.watermark_show_dashboard || "true").toLowerCase() === "true";
  const wmShowPrint  = (cfg?.watermark_show_print    || "true").toLowerCase() === "true";
  const wmOpacityScreen = Math.max(0, Math.min(1, Number(cfg?.watermark_opacity_screen || 0.12)));
  const wmOpacityPrint  = Math.max(0, Math.min(1, Number(cfg?.watermark_opacity_print  || 0.08)));
  const wmAngleDeg = Number(cfg?.watermark_angle_deg || -30);
  const wmSize = (cfg?.watermark_size || "40vw");
  const wmFallbackText = (cfg?.watermark_default_text || (reports.length === 0 ? "WELLSERV" : "")).trim();
  const hasWm = Boolean(wmText || wmImgUrl || wmFallbackText);

  // Visit notes toggle (default hidden)
  const showVisitNotes = (cfg?.show_visit_notes || "").toLowerCase() === "true";

  // Derived report selection
  const visitDates = useMemo(
    () => Array.from(new Set(reports.map(r => r.visit.date_of_test))).sort((a,b)=>b.localeCompare(a)),
    [reports]
  );
  const report = useMemo(() => {
    if (!reports.length) return undefined;
    const current = selectedDate || visitDates[0];
    return reports.find(r => r.visit.date_of_test === current) || reports[0];
  }, [reports, selectedDate, visitDates]);

  // Index of values by visit date -> analyte key -> { value, unit }
  const valueIndex = useMemo(() => {
    const map = new Map<string, Map<string, { value: number; unit?: string }>>();
    for (const r of reports) {
      const d = r.visit.date_of_test;
      let m = map.get(d);
      if (!m) { m = new Map(); map.set(d, m); }
      for (const s of r.sections) {
        for (const it of s.items) {
          const v = toNum(it.value);
          if (v == null) continue;
          m.set(it.key, { value: v, unit: it.unit });
        }
      }
    }
    return map;
  }, [reports]);

  // Find the nearest earlier visit that has a numeric value (and same unit, if present)
// Find up to `maxCount` earlier visits with a numeric value for the same key (same unit)
  function findPrevList(it: ReportItem, maxCount = 3): Array<{ date: string; value: number }> {
    if (!report) return [];
    const currentDate = report.visit.date_of_test;
    const idx = visitDates.indexOf(currentDate); // visitDates is DESC
    if (idx < 0) return [];

    const out: Array<{ date: string; value: number }> = [];
    for (let i = idx + 1; i < visitDates.length && out.length < maxCount; i++) {
      const d = visitDates[i];
      const m = valueIndex.get(d);
      const rec = m?.get(it.key);
      if (!rec) continue;
      // Skip if unit changes between visits to avoid bad comparisons
      if (it.unit && rec.unit && it.unit !== rec.unit) continue;
      out.push({ date: d, value: rec.value });
    }
    return out;
  }


  async function search() {
    if (!patientId) return;
    setErr(""); setLoading(true);
    try {
      const res = await fetch(`/api/report?patient_id=${encodeURIComponent(patientId)}`);
      const json = (await res.json()) as ReportResponse;
      if (!res.ok) {
        setErr((json as any)?.error || "Something went wrong.");
        setData(null); setSelectedDate(""); return;
      }
      if (!json?.reports?.length) {
        setErr("No matching patient ID, please try again.");
        setData(null); setSelectedDate(""); return;
      }
      setData(json);
      const dates = Array.from(new Set(json.reports.map(r => r.visit.date_of_test))).sort((a,b)=>b.localeCompare(a));
      setSelectedDate(dates[0] || "");
    } catch (e:any) {
      setErr(e?.message || "Network error."); setData(null); setSelectedDate("");
    } finally { setLoading(false); }
  }

  // signers + logo (computed BEFORE return)
  const { rmts, pathos } = getSignersFromConfig(cfg);
  const signers = [...rmts, ...pathos];
  const { primary: logoPrimary, fallback: logoFallback } = driveImageUrls(cfg.clinic_logo_url);
  const logoSrc = logoPrimary;

  return (
    <div className="page" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <style>{`
        :root{
          /* ---------- theme knobs ---------- */
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
        .controls { display:flex; gap:8px; margin:12px 0; flex-wrap:wrap; }
        .content { flex: 1 0 auto; }
        th, td { padding: var(--row-pad); }

        /* clinic header */
        .clinic { display:flex; align-items:center; gap:12px; margin: 8px 0 12px 0; }
        .clinic img { height: var(--logo-height); width:auto; object-fit: contain; display:block; }
        .clinic-name { font-weight: 700; font-size: 20px; line-height: 1.2; }
        .clinic-sub { color:#444; }

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
          .controls { display:none !important; }
          .report-footer { page-break-inside: avoid; }
          body { margin: 0; }
        }

        /* --- Watermark layer --- */
        .page { position: relative; }
        .page > * { position: relative; z-index: 1; }
        .wm-layer { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
        .wm-text { font-weight: 700; color: #000; letter-spacing: 0.1em; font-size: var(--wm-size, 10vw); white-space: nowrap; text-transform: uppercase; mix-blend-mode: multiply; opacity: var(--wm-opacity, 0.08); transform: rotate(var(--wm-angle, -30deg)); }
        .wm-img { width: var(--wm-size, 60vw); height: auto; opacity: var(--wm-opacity, 0.06); transform: rotate(var(--wm-angle, -30deg)); // filter: grayscale(100%); mix-blend-mode: multiply; // }
        @media print {
          .wm-layer { display: flex !important; }
          .wm-layer[data-print="off"] { display: none !important; }
          .wm-text, .wm-img { opacity: var(--wm-opacity-print, 0.08); }
        }
      `}</style>

      {hasWm && (
        <div
          className="wm-layer"
          data-print={wmShowPrint ? "on" : "off"}
          style={{
            display: wmShowScreen ? "flex" : "none",
            ["--wm-opacity" as any]: String(wmOpacityScreen),
            ["--wm-opacity-print" as any]: String(wmOpacityPrint),
            ["--wm-angle" as any]: `${wmAngleDeg}deg`,
            ["--wm-size" as any]: wmSize,
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

      <div className="container content">
        {/* ---------- CLINIC HEADER ---------- */}
        {(cfg.clinic_name || cfg.clinic_logo_url || cfg.clinic_address || cfg.clinic_phone) && (
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
        )}

        <h1 className="print:hidden" style={{ marginTop: 4, marginBottom: 8 }}>View Lab Results</h1>

        <div className="controls">
          <input
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && patientId.trim()) {
                e.preventDefault();
                search();
              }
            }}
            placeholder="Enter Patient ID"
            style={{ padding:"8px 10px", border:"1px solid var(--border)", borderRadius:6, width:260 }}
          />

          <button
            onClick={search}
            disabled={loading || !patientId.trim()}
            style={{ padding:"8px 14px", borderRadius:6, border:"1px solid #222222ff", background:"#222", color:"#fff" }}
          >
            {loading ? "Loading..." : "View"}
          </button>

          <label style={{ display:"flex", alignItems:"center", gap:6, marginLeft:12 }}>
            <input
              type="checkbox"
              checked={compareOn}
              onChange={(e)=>setCompareOn(e.target.checked)}
            />
            Compare with last visit
          </label>


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
                style={{ padding:"8px 10px", border:"1px solid var(--border)", borderRadius:6, marginLeft:8 }}
              >
                Print / Save as PDF
              </button>
            </div>
          )}
        </div>

        {err && <div style={{ color:"#b00020", marginTop:4 }}>{err}</div>}

        {report && (
          <>
            <div style={{ margin:"12px 0", lineHeight:1.4 }}>
              <div style={{ fontWeight:700 }}>{report.patient.full_name}</div>
              <div>{report.patient.sex} • {report.patient.age} yrs • DOB {report.patient.birthday}</div>
              <div>Date of Test: <b>{report.visit.date_of_test}</b></div>

              {showVisitNotes && report?.visit?.notes?.trim() && (
                <div><strong>Notes:</strong> {report.visit.notes}</div>
              )}
            </div>

            {report.sections.map(section => (
              <div key={section.name} style={{ marginTop:18 }}>
                <h3 style={{ margin:"10px 0" }}>{section.name}</h3>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign:"left" }}>Parameter</th>
                      <th style={{ textAlign:"right" }}>Result</th>
                      {compareOn && <th style={{ textAlign:"right" }}>Prev. Res.</th>}
                      {compareOn && <th style={{ textAlign:"right" }}>Latest % Change</th>}
                      <th style={{ textAlign:"left" }}>Unit</th>
                      <th style={{ textAlign:"left" }}>Reference</th>
                      <th style={{ textAlign:"center" }} aria-label="Flag"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map(it => {
                      if (!it.value) return null;
                      const refText = formatRef(it.ref);
                      const cur = toNum(it.value);
                      const prevList = compareOn ? findPrevList(it, 3) : [];

                      // Δ is computed vs the most recent previous result only (Prev #1)
                      const prev1 = prevList[0];

                      let deltaText = "—";
                      let deltaColor = "#666";
                      if (cur != null && prev1) {
                        const delta = cur - prev1.value;
                        const pct = prev1.value !== 0 ? (delta / prev1.value) * 100 : null;
                        const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
                        deltaText = `${arrow} ${delta > 0 ? "+" : ""}${fmt(delta)}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`;
                        deltaColor = delta > 0 ? "#b00020" : delta < 0 ? "#1976d2" : "#666";
                      }

                      return (
                        <tr key={it.key}>
                          <td>{it.label}</td>
                          <td style={{ textAlign:"right" }}>{it.value}</td>

                          {compareOn && (
                            <>
                              <td style={{ textAlign:"right" }}>
                                {prevList.length ? (
                                  // show up to 3 lines: DATE: VALUE
                                  prevList.map(p => (
                                    <div key={p.date} style={{ whiteSpace:"nowrap", fontSize:12, lineHeight:1.2 }}>
                                      {formatPrevDate(p.date)}: {fmt(p.value)}
                                    </div>
                                  ))
                                ) : "—"}
                              </td>
                              <td style={{ textAlign:"right", color: deltaColor }}>{deltaText}</td>
                            </>
                          )}

                          <td>{it.unit || ""}</td>
                          <td>{refText}</td>
                          <td style={{
                            textAlign:"center",
                            color: it.flag==="H" ? "#b00020" : it.flag==="L" ? "#1976d2" : it.flag==="A" ? "#f57c00" : "#666"
                          }}>
                            {it.flag || ""}
                          </td>
                        </tr>
                      );

                    })}
                  </tbody>
                </table>
              </div>
            ))}
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

"use client";
import { useMemo, useState } from "react";

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

export default function Portal() {
  const [patientId, setPatientId] = useState("");
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const cfg = (data?.config ?? {}) as Record<string, string>;
  const reports = data?.reports ?? [];

  const visitDates = useMemo(
    () => Array.from(new Set(reports.map(r => r.visit.date_of_test))).sort((a,b)=>b.localeCompare(a)),
    [reports]
  );
  const report = useMemo(() => {
    if (!reports.length) return undefined;
    const current = selectedDate || visitDates[0];
    return reports.find(r => r.visit.date_of_test === current) || reports[0];
  }, [reports, selectedDate, visitDates]);

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
  const logoSrc = logoPrimary; // we fallback in onError

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
        .report-footer {
          margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border);
          font-size: 14px; color: var(--brand);
        }
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
      `}</style>

      <div className="container content">
        {/* ---------- CLINIC HEADER ---------- */}
        {(cfg.clinic_name || cfg.clinic_logo_url || cfg.clinic_address || cfg.clinic_phone) && (
          <div className="clinic">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                referrerPolicy="no-referrer"
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

        <h1 style={{ marginTop: 4, marginBottom: 8 }}>View Lab Results</h1>

        <div className="controls">
          <input value={patientId} onChange={(e)=>setPatientId(e.target.value)}
            placeholder="Enter Patient ID"
            style={{ padding:"8px 10px", border:"1px solid var(--border)", borderRadius:6, width:260 }}/>
          <button onClick={search} disabled={loading || !patientId}
            style={{ padding:"8px 14px", borderRadius:6, border:"1px solid #222", background:"#222", color:"#fff" }}>
            {loading ? "Loading..." : "View"}
          </button>
          {visitDates.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <label style={{ fontSize:14 }}>Visit date:</label>
              <select value={report?.visit.date_of_test || ""} onChange={(e)=>setSelectedDate(e.target.value)}
                style={{ padding:"8px 10px", border:"1px solid var(--border)", borderRadius:6 }}>
                {visitDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {report && (
            <button onClick={()=>window.print()}
              style={{ padding:"8px 14px", borderRadius:6, border:"1px solid var(--border)", background:"#fff" }}>
              Print
            </button>
          )}
        </div>

        {err && <div style={{ color:"#b00020", marginTop:4 }}>{err}</div>}

        {report && (
          <>
            <div style={{ margin:"12px 0", lineHeight:1.4 }}>
              <div style={{ fontWeight:700 }}>{report.patient.full_name}</div>
              <div>{report.patient.sex} • {report.patient.age} yrs • DOB {report.patient.birthday}</div>
              <div>Date of Test: <b>{report.visit.date_of_test}</b></div>
              {report.visit.notes && <div>Notes: {report.visit.notes}</div>}
            </div>

            {report.sections.map(section => (
              <div key={section.name} style={{ marginTop:18 }}>
                <h3 style={{ margin:"10px 0" }}>{section.name}</h3>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign:"left" }}>Parameter</th>
                      <th style={{ textAlign:"right" }}>Result</th>
                      <th style={{ textAlign:"left" }}>Unit</th>
                      <th style={{ textAlign:"left" }}>Reference</th>
                      <th style={{ textAlign:"center" }} aria-label="Flag"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map(it => {
                      if (!it.value) return null;
                      const refText = formatRef(it.ref);
                      return (
                        <tr key={it.key}>
                          <td>{it.label}</td>
                          <td style={{ textAlign:"right" }}>{it.value}</td>
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

      {/* ---------- FOOTER (multi-RMT + pathologist) ---------- */}
      <footer className="report-footer container">
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
                <div className="muted">
                  {s.role}{s.license ? ` – PRC ${s.license}` : ""}
                </div>
              </div>
            );
          })}
        </div>

        {(cfg.report_footer_line1 || cfg.report_footer_line2 || cfg.report_footer_line3) && (
          <div style={{ textAlign:"center", marginTop:10, lineHeight:1.3, width:"100%" }}>
            {cfg.report_footer_line1 && <div>{cfg.report_footer_line1}</div>}
            {cfg.report_footer_line2 && <div>{cfg.report_footer_line2}</div>}
            {cfg.report_footer_line3 && <div>{cfg.report_footer_line3}</div>}
          </div>
        )}
      </footer>
    </div>
  );
}

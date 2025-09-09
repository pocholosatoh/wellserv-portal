"use client";
import { useEffect, useMemo, useState } from "react";

type RefInfo = { low?: number; high?: number; normal_values?: string };
type ReportItem = { key:string; label:string; value:string; unit?:string; flag?:""|"L"|"H"|"A"; ref?: RefInfo };
type ReportSection = { name:string; items:ReportItem[] };
type Patient = { patient_id:string; full_name:string; age:string; sex:string; birthday:string; contact:string; address:string };
type Visit = { date_of_test:string; barcode:string; notes:string };
type Report = { patient:Patient; visit:Visit; sections:ReportSection[] };
type ReportResponse = { count:number; reports:Report[]; config?: Record<string,string> };

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

/** Extract a Google Drive file ID from common link shapes */
function extractDriveId(url?: string) {
  const u = (url || "").trim();
  if (!u) return "";
  // uc?export=view&id=FILEID
  const uc = u.match(/[?&]id=([^&]+)/);
  if (uc?.[1]) return uc[1];
  // /file/d/FILEID/view
  const file = u.match(/\/file\/d\/([^/]+)/);
  if (file?.[1]) return file[1];
  // already looks like an id
  if (/^[a-zA-Z0-9_-]{20,}$/.test(u)) return u;
  return "";
}

/** Primary & fallback direct image URLs for a public Drive file */
function driveImageUrls(url?: string) {
  const id = extractDriveId(url);
  if (!id) return { primary: "", fallback: "" };
  return {
    primary: `https://drive.google.com/uc?export=view&id=${id}`,
    // Alternate googleusercontent host that often works when uc fails in <img>
    fallback: `https://lh3.googleusercontent.com/d/${id}`,
  };
}

export default function Portal() {
  const [patientId, setPatientId] = useState("");
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const cfg = (data?.config ?? {}) as Record<string,string>;
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
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/report?patient_id=${encodeURIComponent(patientId)}`);
      const json = (await res.json()) as ReportResponse;

      if (!res.ok) {
        setErr((json as any)?.error || "Something went wrong.");
        setData(null);
        setSelectedDate("");
        return;
      }

      if (!json?.reports?.length) {
        setErr("No matching patient ID, please try again.");
        setData(null);
        setSelectedDate("");
        return;
      }

      setData(json);
      const dates = Array.from(new Set((json.reports || []).map(r => r.visit.date_of_test))).sort((a,b)=>b.localeCompare(a));
      setSelectedDate(dates[0] || "");
    } catch (e: any) {
      setErr(e?.message || "Network error.");
      setData(null);
      setSelectedDate("");
    } finally {
      setLoading(false);
    }
  }

  // ---- Signature image handling (primary + fallback) ----
  const rmtUrls = driveImageUrls(cfg.rmt_signature_url);
  const pathoUrls = driveImageUrls(cfg.patho_signature_url);

  const [rmtSrc, setRmtSrc] = useState(rmtUrls.primary);
  const [pathoSrc, setPathoSrc] = useState(pathoUrls.primary);
  const [rmtFailed, setRmtFailed] = useState(false);
  const [pathoFailed, setPathoFailed] = useState(false);

  // Update image srcs whenever config changes
  useEffect(() => {
    setRmtFailed(false);
    setPathoFailed(false);
    setRmtSrc(rmtUrls.primary);
    setPathoSrc(pathoUrls.primary);
  }, [cfg.rmt_signature_url, cfg.patho_signature_url]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <style>{`
        .container { max-width: 960px; margin: 0 auto; padding: 16px; }
        .controls { display:flex; gap:8px; margin:12px 0; flex-wrap:wrap; }
        .content { flex: 1 0 auto; }
        .report-footer {
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid #ddd;
          font-size: 14px;
          color: #111;
        }
        .sig-row { display:flex; gap:16px; align-items:flex-end; }
        .sig { flex:1; text-align:center; }
        .sig img { max-height: 90px; width: auto; object-fit: contain; display:block; margin: 0 auto 6px; }
        .muted { color:#444; font-size: 12px; }
        .debug { font-size: 12px; color:#555; text-align:center; }
        @media print {
          .controls { display: none !important; }
          .report-footer { page-break-inside: avoid; }
          body { margin: 0; }
        }
      `}</style>

      <div className="container content">
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>View Lab Results</h1>

        <div className="controls">
          <input
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Enter Patient ID"
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, width: 260 }}
          />
          <button
            onClick={search}
            disabled={loading || !patientId}
            style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #222", background: "#222", color: "#fff" }}
          >
            {loading ? "Loading..." : "View"}
          </button>

          {visitDates.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 14 }}>Visit date:</label>
              <select
                value={report?.visit.date_of_test || ""}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6 }}
              >
                {visitDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {report && (
            <button onClick={() => window.print()}
              style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #999", background: "#fff" }}>
              Print
            </button>
          )}
        </div>

        {err && <div style={{ color: "#b00020", marginTop: 4 }}>{err}</div>}

        {report && (
          <>
            <div style={{ margin: "12px 0", lineHeight: 1.4 }}>
              <div style={{ fontWeight: 700 }}>{report.patient.full_name}</div>
              <div>{report.patient.sex} • {report.patient.age} yrs • DOB {report.patient.birthday}</div>
              <div>Date of Test: <b>{report.visit.date_of_test}</b></div>
              {report.visit.notes && <div>Notes: {report.visit.notes}</div>}
            </div>

            {report.sections.map((section) => (
              <div key={section.name} style={{ marginTop: 18 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0" }}>{section.name}</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px" }}>Parameter</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "6px" }}>Result</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px" }}>Unit</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px" }}>Reference</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: "6px" }} aria-label="Flag"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((it) => {
                      if (!it.value) return null;
                      const refText = formatRef(it.ref);
                      return (
                        <tr key={it.key}>
                          <td style={{ padding: "6px" }}>{it.label}</td>
                          <td style={{ padding: "6px", textAlign: "right" }}>{it.value}</td>
                          <td style={{ padding: "6px" }}>{it.unit || ""}</td>
                          <td style={{ padding: "6px" }}>{refText}</td>
                          <td
                            style={{
                              padding: "6px",
                              textAlign: "center",
                              color:
                                it.flag === "H" ? "#b00020" :
                                it.flag === "L" ? "#1976d2" :
                                it.flag === "A" ? "#f57c00" : "#666"
                            }}
                          >
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

      <footer className="report-footer container">
        <div className="sig-row">
          <div className="sig">
            {rmtSrc && !rmtFailed ? (
              <img
                src={rmtSrc}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => {
                  // try fallback once, then mark failed
                  if (rmtSrc !== rmtUrls.fallback && rmtUrls.fallback) setRmtSrc(rmtUrls.fallback);
                  else setRmtFailed(true);
                }}
              />
            ) : null}
            {cfg.rmt_name && <div><strong>{cfg.rmt_name}</strong></div>}
            {(cfg.rmt_license || cfg.rmt_name) && (
              <div className="muted">RMT{cfg.rmt_license ? ` – PRC ${cfg.rmt_license}` : ""}</div>
            )}
            {/* screen-only debug helper */}
            {!rmtSrc || rmtFailed ? (
              <div className="debug">
                (Signature image not visible. Check sharing or click{" "}
                <a href={rmtUrls.primary || "#"} target="_blank" rel="noreferrer">this link</a>.)
              </div>
            ) : null}
          </div>

          <div className="sig">
            {pathoSrc && !pathoFailed ? (
              <img
                src={pathoSrc}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => {
                  if (pathoSrc !== pathoUrls.fallback && pathoUrls.fallback) setPathoSrc(pathoUrls.fallback);
                  else setPathoFailed(true);
                }}
              />
            ) : null}
            {cfg.patho_name && <div><strong>{cfg.patho_name}</strong></div>}
            {(cfg.patho_license || cfg.patho_name) && (
              <div className="muted">Pathologist{cfg.patho_license ? ` – PRC ${cfg.patho_license}` : ""}</div>
            )}
            {!pathoSrc || pathoFailed ? (
              <div className="debug">
                (Signature image not visible. Check sharing or click{" "}
                <a href={pathoUrls.primary || "#"} target="_blank" rel="noreferrer">this link</a>.)
              </div>
            ) : null}
          </div>
        </div>

        {(cfg.report_footer_line1 || cfg.report_footer_line2 || cfg.report_footer_line3) && (
          <div style={{ textAlign: "center", marginTop: 10, lineHeight: 1.3 }}>
            {cfg.report_footer_line1 && <div>{cfg.report_footer_line1}</div>}
            {cfg.report_footer_line2 && <div>{cfg.report_footer_line2}</div>}
            {cfg.report_footer_line3 && <div>{cfg.report_footer_line3}</div>}
          </div>
        )}
      </footer>
    </div>
  );
}

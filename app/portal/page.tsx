"use client";
import { useMemo, useState } from "react";

type ReportItem = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  flag?: "" | "L" | "H" | "A";
  ref?: { low?: number; high?: number; normal_values?: string };
};
type ReportSection = { name: string; items: ReportItem[] };
type Patient = {
  patient_id: string; full_name: string; age: string; sex: string;
  birthday: string; contact: string; address: string;
};
type Visit = { date_of_test: string; barcode: string; notes: string };
type Report = { patient: Patient; visit: Visit; sections: ReportSection[] };

function formatRef(ref?: { low?: number; high?: number; normal_values?: string }) {
  if (!ref) return "";
  const hasLow  = typeof ref.low  === "number";
  const hasHigh = typeof ref.high === "number";
  if (hasLow && hasHigh) return `${ref.low}–${ref.high}`;
  if (hasLow)  return `≥ ${ref.low}`;
  if (hasHigh) return `≤ ${ref.high}`;
  if (ref.normal_values) return ref.normal_values; // e.g., "Negative"
  return "";
}

export default function Portal() {
  const [patientId, setPatientId] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    if (!patientId) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/report?patient_id=${encodeURIComponent(patientId)}`);
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error || "Something went wrong.");
        setReports([]);
        setSelectedDate("");
      } else {
        const reps: Report[] = json?.reports || [];
        setReports(reps);

        // Build unique visit dates (sorted newest first)
        const dates = Array.from(new Set(reps.map(r => r.visit.date_of_test))).sort((a, b) => b.localeCompare(a));
        setSelectedDate(dates[0] || "");
      }
    } catch (e: any) {
      setErr(e?.message || "Network error.");
      setReports([]);
      setSelectedDate("");
    } finally {
      setLoading(false);
    }
  }

  // Current report based on the selected visit date
  const report = useMemo(() => {
    if (!selectedDate) return reports[0];
    return reports.find(r => r.visit.date_of_test === selectedDate) || reports[0];
  }, [reports, selectedDate]);

  const SHOW_VISIT_NOTES = false;

  // All available visit dates for the picker
  const visitDates = useMemo(() => {
    return Array.from(new Set(reports.map(r => r.visit.date_of_test))).sort((a, b) => b.localeCompare(a));
  }, [reports]);

  return (
    <div style={{ padding: "16px", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>View Lab Results</h1>

      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
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

        {/* Visit date picker (only shown when we have results) */}
        {visitDates.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 14 }}>Visit date:</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6 }}
            >
              {visitDates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        {report && (
          <button
            onClick={() => window.print()}
            style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #999", background: "#fff" }}
          >
            Print
          </button>
        )}
      </div>

      {err && <div style={{ color: "#b00020", marginTop: 4 }}>{err}</div>}

      {report && (
        <>
          <div style={{ margin: "12px 0", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700 }}>{report.patient.full_name}</div>
            <div>
              {report.patient.sex} • {report.patient.age} yrs • DOB {report.patient.birthday}
            </div>
            <div>Processed Date: <b>{report.visit.date_of_test}</b></div>
            {SHOW_VISIT_NOTES && report.visit.notes && <div>Notes: {report.visit.notes}</div>}
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
                    <th
                      style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: "6px" }}
                      aria-label="Flag"
                    />
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((it) => {
                    // Just in case: don't render blank values (API already filters, but we double-guard here)
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
  );
}

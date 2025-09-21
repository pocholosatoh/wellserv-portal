"use client";

import { useState } from "react";
import Papa, { ParseResult } from "papaparse";

type Row = Record<string, any>;
type PanelKey = "si" | "sl";

function Panel({ label, sheetKey }: { label: string; sheetKey: PanelKey }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");

  function handleFile(file: File) {
    setStatus("Parsing…");
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<Row>) => {
        const data = results.data || [];
        setRows(data);
        setStatus(`Parsed ${data.length} rows`);
      },
      error: (err: any) => setStatus(`Parse error${err?.message ? `: ${err.message}` : ""}`),
    });
  }

  async function upload() {
    setStatus("Uploading…");
    const res = await fetch("/api/rmt/hema/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rmt-secret": process.env.NEXT_PUBLIC_RMT_UPLOAD_SECRET || "",
      },
      body: JSON.stringify({ sheetKey, rows }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json.error || "Upload failed");
      return;
    }

    const miss: string[] = json.missingHeaders || [];
    const nf: string[] = json.notFound || [];

    let msg = `Done. Updated rows: ${json.updatedRows || 0}`;
    if (miss.length) msg += ` • Missing headers: ${miss.join(", ")}`;
    if (nf.length) msg += ` • Patient IDs not found: ${nf.slice(0, 10).join(", ")}${nf.length > 10 ? "…" : ""}`;
    setStatus(msg);
  }

  const previewKeys = rows.length ? Object.keys(rows[0]).slice(0, 16) : [];

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{label}</h2>
        <div style={{ color: "#666" }}>{status}</div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button onClick={upload} disabled={rows.length === 0} style={{ padding: "8px 14px" }}>
          Upload to {label}
        </button>
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: "auto", fontSize: 12 }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Preview (first 10 rows)</div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {previewKeys.map((h) => (
                  <th
                    key={h}
                    style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  {previewKeys.map((h) => (
                    <td key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #f6f6f6" }}>
                      {String(r[h] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RmtUploadPage() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1 style={{ marginBottom: 0 }}>Hematology Upload</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        CSV headers must match the <b>Database</b> tab columns in each branch sheet.
        Required: <code>patient_id</code>, plus any of:{" "}
        <code>WBC, Lympho, MID, Gran, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, Platelet</code>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel label="San Isidro (SI)" sheetKey="si" />
        <Panel label="San Leonardo (SL)" sheetKey="sl" />
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Papa, { ParseResult } from "papaparse";
import { BRANCHES } from "@/lib/branches";  // <-- only key + label used on client

type Row = Record<string, any>;

// Exact CSV headers to preview, in fixed order
const PREVIEW_HEADERS = [
  "Patient ID",
  "WBC (10^9/L)",
  "Lymph% ( )",
  "Mid% ( )",
  "Gran% ( )",
  "RBC (10^12/L)",
  "HGB (g/L)",
  "HCT ( )",
  "MCV (fL)",
  "MCH (pg)",
  "MCHC (g/L)",
  "PLT (10^9/L)",
];

function Panel({ label, sheetKey }: { label: string; sheetKey: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const UPLOAD_SECRET = process.env.NEXT_PUBLIC_RMT_UPLOAD_SECRET || "";

  function handleFile(file: File) {
    setStatus("Parsing…");
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res: ParseResult<Row>) => {
        setRows(res.data || []);
        setStatus(`Parsed ${res.data?.length ?? 0} rows`);
      },
      error: (err) => setStatus(`Parse error${(err as any)?.message ? `: ${(err as any).message}` : ""}`),
    });
  }

  async function upload() {
    setStatus("Uploading…");
    if (!UPLOAD_SECRET) {
      setStatus("Error: NEXT_PUBLIC_RMT_UPLOAD_SECRET is missing in .env.local");
      return;
    }

    const res = await fetch("/api/rmt/hema/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetKey,
        rows,
        sheetName: "Results",               // optional; our API defaults to "Database"
        secret: UPLOAD_SECRET,               // <-- send secret in BODY (not header)
      }),
    });

    const data = await res.json().catch(() => ({} as any));

    if (!res.ok || !data?.ok) {
      const mh = Array.isArray(data?.missingHeaders)
        ? ` Missing headers: ${data.missingHeaders.join(", ")}`
        : "";
      setStatus(`Error: ${data?.error || res.statusText}.${mh}`);
      return;
    }

    const updatedExisting = Number(data.updatedExisting ?? 0);
    const appended = Number(data.appended ?? 0);
    const total = updatedExisting + appended;

    setStatus(
      `Done. Updated: ${total} (modified existing: ${updatedExisting}, added new: ${appended})`
    );
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{label}</h2>
        <div style={{ color: "#666" }}>{status}</div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
                {PREVIEW_HEADERS.map(h => (
                  <th
                    key={h}
                    style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  {PREVIEW_HEADERS.map(h => (
                    <td key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #f6f6f6", whiteSpace: "nowrap" }}>
                      {String((r as Record<string, any>)[h] ?? "")}
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
      <p style={{ marginTop: 8, color: "#666" }}>
        Google Sheet must have these destination columns (row 1):{" "}
        <code>patient_id, hema_wbc, hema_lymph, hema_mid, hema_gran, hema_rbc, hema_hgb, hema_hct, hema_mcv, hema_mch, hema_mchc, hema_plt</code>.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {BRANCHES.map(b => (
          <Panel key={b.key} label={b.label} sheetKey={b.key} />
        ))}
      </div>
    </div>
  );
}

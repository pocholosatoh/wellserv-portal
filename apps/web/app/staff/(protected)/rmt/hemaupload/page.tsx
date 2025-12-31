"use client";
import { useState } from "react";
import Papa, { ParseResult } from "papaparse";
import { BRANCHES } from "@/lib/branches"; // <-- only key + label used on client

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
      error: (err) =>
        setStatus(`Parse error${(err as any)?.message ? `: ${(err as any).message}` : ""}`),
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
        sheetName: "Results", // optional; our API defaults to "Database"
        secret: UPLOAD_SECRET, // <-- send secret in BODY (not header)
      }),
    });

    const data = await res.json().catch(() => ({}) as any);

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
      `Done. Updated: ${total} (modified existing: ${updatedExisting}, added new: ${appended})`,
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <div className="text-sm text-gray-600">{status || "Waiting for CSV…"}</div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="text-sm"
        />
        <button
          onClick={upload}
          disabled={rows.length === 0}
          className="w-full rounded bg-[#44969b] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
        >
          Upload to {label}
        </button>
      </div>
      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto text-xs">
          <div className="mb-2 font-semibold">Preview (first 10 rows)</div>
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr>
                {PREVIEW_HEADERS.map((h) => (
                  <th key={h} className="whitespace-nowrap border-b px-2 py-1 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i} className="odd:bg-gray-50/60">
                  {PREVIEW_HEADERS.map((h) => (
                    <td key={h} className="whitespace-nowrap border-b px-2 py-1">
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
    <div className="mx-auto max-w-5xl space-y-3 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Hematology Upload</h1>
      <p className="text-sm text-gray-600">
        Google Sheet must have these destination columns (row 1):{" "}
        <code className="whitespace-pre-wrap break-words">
          patient_id, hema_wbc, hema_lymph, hema_mid, hema_gran, hema_rbc, hema_hgb, hema_hct,
          hema_mcv, hema_mch, hema_mchc, hema_plt
        </code>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {BRANCHES.map((b) => (
          <Panel key={b.key} label={b.label} sheetKey={b.key} />
        ))}
      </div>
    </div>
  );
}

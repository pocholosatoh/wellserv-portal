// StartConsultBar.tsx
"use client";

import { useState } from "react";

export default function StartConsultBar({
  patientId,
  onStarted,
}: {
  patientId: string;
  onStarted: (consultationId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    try {
      setBusy(true);
      setErr(null);

      const res = await fetch("/api/consultations/upsert-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const json = await res.json();

      if (!res.ok || !json?.consultation?.id) {
        throw new Error(json?.error || "Failed to start consultation.");
      }

      const id = String(json.consultation.id);
      onStarted(id);

      // Keep the consultation id in the URL so other panels (e.g., Diagnoses)
      // can unlock immediately.
      const url = new URL(window.location.href);
      url.searchParams.set("c", id);
      window.history.replaceState({}, "", url.toString());
    } catch (e: any) {
      setErr(e?.message || "Failed to start consultation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center gap-3">
        <div className="text-sm">
          Click to create (or reuse) a consultation. This enables notes and prescription.
        </div>
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="ml-auto rounded bg-[#44969b] text-white px-3 py-2 text-sm"
        >
          {busy ? "Starting…" : "Start consultation"}
        </button>
      </div>
      {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
    </div>
  );
}

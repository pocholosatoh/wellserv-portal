"use client";

import { useEffect, useMemo, useState } from "react";
import DiagnosisCard from "./DiagnosisCard";
import { useSearchParams } from "next/navigation";

export default function DiagnosisPanel({
  patientId,
  initialConsultationId,
}: {
  patientId: string;
  initialConsultationId: string | null;
}) {
  const sp = useSearchParams();
  // Pick up ?c=... if present (e.g. coming from queue resume)
  const urlCid = useMemo(() => {
    const c = sp.get("c");
    return c && c.trim() ? c.trim() : null;
  }, [sp]);

  const [cid, setCid] = useState<string | null>(
    urlCid || initialConsultationId || null
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refreshCid() {
    try {
        setBusy(true);
        setErr(null);
        const u = new URL("/api/consultations/resolve-id", window.location.origin);
        u.searchParams.set("patient_id", patientId);
        u.searchParams.set("scope", "latest");   // ← not restricted to today
        // if you ever want branch scoping: u.searchParams.set("branchOnly", "1");
        const r = await fetch(u.toString(), { cache: "no-store" });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j?.error || `HTTP ${r.status}`);
        setCid(j.consultation_id || null);
    } catch (e: any) {
        setErr(e?.message || "Failed to resolve consultation.");
    } finally {
        setBusy(false);
    }
    }

  // If URL param appears later (e.g., navigation), adopt it
  useEffect(() => {
    if (urlCid && urlCid !== cid) setCid(urlCid);
  }, [urlCid]);

  return (
    <div className="space-y-3">
      <DiagnosisCard consultationId={cid} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs"
          onClick={refreshCid}
          disabled={busy}
          title="Pick up the consultation started in the Notes panel"
        >
          {busy ? "Checking…" : "Refresh consultation link"}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
        {!cid && !err && (
          <span className="text-xs text-gray-500">
            Tip: Press <b>Start consultation</b> above, then click Refresh.
          </span>
        )}
      </div>
    </div>
  );
}

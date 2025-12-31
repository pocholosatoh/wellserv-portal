"use client";

import { useEffect, useState } from "react";

type RxState = "none" | "draft" | "signed";

export default function FinishConsultButton({
  consultationId,
  encounterId, // kept so parent can finalize after consent
  onFinished, // kept (parent can still reload after full flow)
  onNeedConsent, // 👈 NEW: parent opens ConsentModal
  encounterLoading = false,
}: {
  consultationId: string;
  encounterId?: string;
  onFinished?: () => void;
  onNeedConsent: () => void; // required for consent-first flow
  encounterLoading?: boolean;
}) {
  const [rxState, setRxState] = useState<RxState>("none");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadRxState() {
    try {
      setErr(null);
      const r = await fetch(
        `/api/claims/preview?consultation_id=${encodeURIComponent(consultationId)}`,
        { cache: "no-store" },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      if (j?.prescription?.status === "signed") setRxState("signed");
      else if (j?.prescription) setRxState("draft");
      else setRxState("none");
    } catch (e: any) {
      setErr(e?.message || "Failed to check prescription state.");
    }
  }

  useEffect(() => {
    if (consultationId) loadRxState();
  }, [consultationId]);

  async function requestFinishWithoutRx() {
    if (!consultationId || !encounterId) return;
    if (!confirm("Mark this consultation as DONE (no prescription)?")) return;
    // 🔴 Do NOT finalize here. Ask parent to open consent.
    onNeedConsent();
  }

  // ---- UI states ----
  if (rxState === "signed") {
    return (
      <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
        <div className="text-xs text-gray-500">Prescription signed — consultation is finished.</div>
        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-1 text-xs">
          Finished (Rx signed)
        </span>
      </div>
    );
  }

  if (rxState === "draft") {
    return (
      <div className="px-4 py-3 bg-gray-50 border-t">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-gray-500">
            A prescription draft exists. Sign it or delete the draft to finish.
          </div>
          <button
            type="button"
            disabled
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-gray-200 text-gray-600 cursor-not-allowed"
            title="A prescription draft exists. Sign it or delete the draft to finish."
          >
            Finish
          </button>
        </div>
        {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-gray-50 border-t">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-xs text-gray-500">
          No medicines to prescribe? You can complete the consult here (consent required).
        </div>
        <button
          type="button"
          onClick={requestFinishWithoutRx}
          disabled={loading || !consultationId || !encounterId}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50"
          title={!encounterId ? "Preparing…" : "Finish consultation without a prescription"}
        >
          {loading ? "Finishing…" : "Finish without Rx"}
        </button>
      </div>
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
      {encounterId ? (
        <div className="mt-2 text-xs text-emerald-700">
          Linked to encounter{" "}
          <span className="font-semibold">
            {encounterId.length > 10 ? `…${encounterId.slice(-6)}` : encounterId}
          </span>
          . Consent will apply to this encounter.
        </div>
      ) : encounterLoading ? (
        <div className="mt-2 text-xs text-gray-500">(Loading encounter… please wait a moment)</div>
      ) : (
        <div className="mt-2 text-xs text-red-600">
          Link this consultation to a same-day encounter above to enable finishing.
        </div>
      )}
    </div>
  );
}

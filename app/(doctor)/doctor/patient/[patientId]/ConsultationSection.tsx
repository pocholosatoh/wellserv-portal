"use client";

import { useEffect, useState } from "react";
import StartConsultBar from "./StartConsultBar";
import NotesPanel from "./NotesPanel";
import RxPanel from "./RxPanel";
import BranchPicker from "./BranchPicker";
import FollowUpPanel from "./FollowUpPanel";
import FinishConsultButton from "./FinishConsultButton";
import ConsentModal from "./ConsentModal"; // ← ensure this file exists

export default function ConsultationSection({
  patientId,
  initialConsultationId = null,
}: {
  patientId: string;
  initialConsultationId?: string | null;
}) {
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId);

  // consult meta
  const [consultType, setConsultType] = useState<"FPE" | "FollowUp" | string | undefined>(undefined);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // consent modal state
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    if (initialConsultationId) setConsultationId(initialConsultationId);
  }, [initialConsultationId]);

  useEffect(() => {
    let aborted = false;
    async function loadMeta() {
      if (!consultationId) return;
      setMetaLoading(true);
      try {
        const r = await fetch(
          `/api/claims/preview?consultation_id=${encodeURIComponent(consultationId)}`,
          { cache: "no-store" }
        );
        const j = await r.json().catch(() => ({}));
        if (!aborted && r.ok) {
          const t = j?.consultation?.type as string | undefined;
          const encId = j?.encounter?.id as string | undefined;
          setConsultType(t);
          setEncounterId(encId ?? null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!aborted) setMetaLoading(false);
      }
    }
    loadMeta();
    return () => { aborted = true; };
  }, [consultationId]);

  const isFPE = String(consultType || "").toUpperCase() === "FPE";
  const badgeText = consultType ? (isFPE ? "FPE" : "Follow-up") : null;
  const badgeClass = isFPE ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800";

  return (
    <section className="space-y-4">
      {!consultationId ? (
        <StartConsultBar patientId={patientId} onStarted={(cid) => setConsultationId(cid)} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
            Consultation started
          </span>
          {badgeText && (
            <span className={`inline-block rounded-full px-2 py-0.5 ${badgeClass}`}>{badgeText}</span>
          )}
          <span>· ID: {consultationId}</span>
          {metaLoading && <span>· loading…</span>}
        </div>
      )}

      <fieldset
        disabled={!consultationId}
        className={`rounded-xl border bg-white shadow-sm transition ${!consultationId ? "opacity-60" : ""}`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Consultation Workspace</h2>
          <BranchPicker consultationId={consultationId} initialBranch={null} />
        </div>

        <div className="divide-y">
          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">Follow-Up</h3>
            <FollowUpPanel patientId={patientId} consultationId={consultationId} defaultBranch={undefined} />
          </div>

          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">Doctor Notes</h3>
            <NotesPanel patientId={patientId} consultationId={consultationId} modeDefault="markdown" autosave={false} />
          </div>

          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">Prescription</h3>
            <RxPanel
              patientId={patientId}
              consultationId={consultationId}
              onSigned={async () => {
                // If we don't have encounterId yet, show modal anyway
                if (!encounterId) { setShowConsent(true); return; }

                try {
                  const r = await fetch(`/api/consents/exists?encounter_id=${encodeURIComponent(encounterId)}`, { cache: "no-store" });
                  const j = await r.json();
                  if (j?.exists) {
                    // Consent already captured earlier. Just refresh UI.
                    window.location.reload();
                  } else {
                    // No consent yet → open modal now
                    setShowConsent(true);
                  }
                } catch {
                  // Network hiccup? Fallback to showing the modal.
                  setShowConsent(true);
                }
              }}
            />

          </div>
        </div>
      </fieldset>

      {consultationId && (
        <FinishConsultButton
          consultationId={consultationId}
          encounterId={encounterId ?? undefined}
          onFinished={() => window.location.reload()}
          // 👇 when finishing without Rx, open consent first
          onNeedConsent={() => setShowConsent(true)}
        />
      )}

      {/* Consent modal for BOTH paths (sign Rx OR finish without Rx) */}
      {consultationId && encounterId && (
        <ConsentModal
          isOpen={showConsent}
          onClose={() => setShowConsent(false)}
          consultationId={consultationId}
          encounterId={encounterId}
          patientId={patientId}
          onSaved={async () => {
            // finalize only here (after consent saved)
            try {
              await fetch("/api/doctor/consultations/finalize", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ consultation_id: consultationId, encounter_id: encounterId }),
              });
            } catch {}
            setShowConsent(false);
            window.location.reload();
          }}
        />
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import StartConsultBar from "./StartConsultBar";
import NotesPanel from "./NotesPanel";
import RxPanel from "./RxPanel";
import BranchPicker from "./BranchPicker";
import FollowUpHistoryCard from "./FollowUpHistoryCard";
import FinishConsultButton from "./FinishConsultButton";
import ConsentModal from "./ConsentModal"; // ← ensure this file exists
import MedicalCertificateDrawer from "./MedicalCertificateDrawer";
import EncounterLinker from "./EncounterLinker";
import { getFollowupAutoclearSkip } from "./followupAutoclearStore";

export default function ConsultationSection({
  patientId,
  initialConsultationId = null,
  defaultBranch = null,
}: {
  patientId: string;
  initialConsultationId?: string | null;
  defaultBranch?: string | null;
}) {
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId);

  // consult meta
  const [consultType, setConsultType] = useState<"FPE" | "FollowUp" | string | undefined>(
    undefined,
  );
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [consultBranch, setConsultBranch] = useState<string>(defaultBranch ?? "");

  // consent modal state
  const [showConsent, setShowConsent] = useState(false);
  const [showMedCert, setShowMedCert] = useState(false);
  const [medCertToast, setMedCertToast] = useState<string | null>(null);

  useEffect(() => {
    if (initialConsultationId) setConsultationId(initialConsultationId);
  }, [initialConsultationId]);

  useEffect(() => {
    if (!medCertToast) return;
    const t = setTimeout(() => setMedCertToast(null), 4500);
    return () => clearTimeout(t);
  }, [medCertToast]);

  useEffect(() => {
    let aborted = false;
    async function loadMeta() {
      if (!consultationId) return;
      setMetaLoading(true);
      try {
        const r = await fetch(
          `/api/claims/preview?consultation_id=${encodeURIComponent(consultationId)}`,
          { cache: "no-store" },
        );
        const j = await r.json().catch(() => ({}));
        if (!aborted && r.ok) {
          const t = j?.consultation?.type as string | undefined;
          const encId = j?.encounter?.id as string | undefined;
          const br = j?.consultation?.branch as string | undefined;
          setConsultType(t);
          setEncounterId(encId ?? null);
          if (br) setConsultBranch(br);
        }
      } catch {
        /* ignore */
      } finally {
        if (!aborted) setMetaLoading(false);
      }
    }
    loadMeta();
    return () => {
      aborted = true;
    };
  }, [consultationId]);

  // Keep branch in sync with initial defaults (from login/session) and fetched consultation meta
  useEffect(() => {
    if (!consultBranch && defaultBranch) setConsultBranch(defaultBranch);
  }, [defaultBranch, consultBranch]);

  const isFPE = String(consultType || "").toUpperCase() === "FPE";
  const badgeText = consultType ? (isFPE ? "FPE" : "Follow-up") : null;
  const badgeClass = isFPE ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800";

  const canIssueMedCert = Boolean(consultationId && encounterId);

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
            <span className={`inline-block rounded-full px-2 py-0.5 ${badgeClass}`}>
              {badgeText}
            </span>
          )}
          <span>· ID: {consultationId}</span>
          {metaLoading && <span>· loading…</span>}
        </div>
      )}

      {medCertToast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {medCertToast}
        </div>
      )}

      <fieldset
        disabled={!consultationId}
        className={`rounded-xl border bg-white shadow-sm transition ${!consultationId ? "opacity-60" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Consultation Workspace</h2>
          <div className="flex items-center gap-2">
            <BranchPicker
              consultationId={consultationId}
              initialBranch={consultBranch}
              fallbackBranch={defaultBranch}
              onChange={(val) => setConsultBranch(val)}
            />
            <button
              type="button"
              onClick={() => setShowMedCert(true)}
              disabled={!canIssueMedCert}
              title={
                canIssueMedCert
                  ? "Generate a medical certificate for this patient"
                  : "Start the consult and ensure an encounter is linked to create a certificate"
              }
              className="rounded-full border border-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent disabled:border-gray-300 disabled:text-gray-400"
            >
              Medical Certificate
            </button>
          </div>
        </div>

        <div className="divide-y">
          {consultationId && (
            <EncounterLinker
              patientId={patientId}
              consultationId={consultationId}
              encounterId={encounterId}
              onLinked={(id) => setEncounterId(id)}
            />
          )}

          <div className="p-4">
            <FollowUpHistoryCard patientId={patientId} />
          </div>

          <div className="p-4">
            <NotesPanel
              patientId={patientId}
              consultationId={consultationId}
              modeDefault="soap"
              autosave
            />
          </div>

          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">Prescription</h3>
            <RxPanel
              patientId={patientId}
              consultationId={consultationId}
              onSigned={async () => {
                // If we don't have encounterId yet, show modal anyway
                if (!encounterId) {
                  setShowConsent(true);
                  return;
                }

                try {
                  const r = await fetch(
                    `/api/consents/exists?encounter_id=${encodeURIComponent(encounterId)}`,
                    { cache: "no-store" },
                  );
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
          encounterLoading={metaLoading}
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
              const skipFollowupAutoclear = getFollowupAutoclearSkip(consultationId);
              await fetch("/api/doctor/consultations/finalize", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  consultation_id: consultationId,
                  encounter_id: encounterId,
                  skip_followup_autoclear: skipFollowupAutoclear,
                }),
              });
            } catch {}
            setShowConsent(false);
            window.location.reload();
          }}
        />
      )}

      {consultationId && encounterId && (
        <MedicalCertificateDrawer
          open={showMedCert}
          onClose={() => setShowMedCert(false)}
          patientId={patientId}
          consultationId={consultationId}
          encounterId={encounterId}
          onIssued={(_certificate, meta) => {
            setMedCertToast(
              meta?.isEdit ? "Medical certificate updated." : "Medical certificate generated.",
            );
            setShowMedCert(false);
          }}
        />
      )}
    </section>
  );
}

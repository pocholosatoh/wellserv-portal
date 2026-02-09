"use client";

import { useEffect, useRef, useState } from "react";
import StartConsultBar from "./StartConsultBar";
import NotesPanel from "./NotesPanel";
import RxPanel from "./RxPanel";
import DiagnosisPanel from "./DiagnosisPanel";
import BranchPicker from "./BranchPicker";
import FollowUpHistoryCard from "./FollowUpHistoryCard";
import FinishConsultButton from "./FinishConsultButton";
import ConsentModal from "./ConsentModal";
import MedicalCertificateDrawer from "./MedicalCertificateDrawer";
import EncounterLinker from "./EncounterLinker";
import { getFollowupAutoclearSkip } from "./followupAutoclearStore";

type PendingFinishIntent = "sign-rx" | "finish-no-rx" | null;

type ConsultationSectionProps = {
  patientId: string;
  initialConsultationId?: string | null;
  defaultBranch?: string | null;
  currentDoctorName?: string | null;
  onRightReload?: () => void;
};

function withDoctorPrefix(name?: string | null) {
  const value = (name || "").trim();
  if (!value) return null;
  if (/^dr\.?\s/i.test(value)) return value;
  return `Dr. ${value}`;
}

function getPersistedFinishedByName(payload: any): string | null {
  const signerName = String(payload?.signer?.name || "").trim();
  if (signerName) return signerName;
  const signingDoctorName = String(payload?.consultation?.signing_doctor_name || "").trim();
  if (signingDoctorName) return signingDoctorName;
  const finishedByName = String(payload?.finished_by_name || "").trim();
  if (finishedByName) return finishedByName;
  return null;
}

function ConsultationSectionInner({
  patientId,
  initialConsultationId = null,
  defaultBranch = null,
  currentDoctorName = null,
  onRightReload,
}: ConsultationSectionProps) {
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId);

  // consult meta
  const [consultType, setConsultType] = useState<"FPE" | "FollowUp" | string | undefined>(
    undefined,
  );
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [consultBranch, setConsultBranch] = useState<string>(defaultBranch ?? "");

  // completion + locking
  const [isFinished, setIsFinished] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [finishedByName, setFinishedByName] = useState<string | null>(null);
  const [finishActionError, setFinishActionError] = useState<string | null>(null);

  // consent flow state
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFinishIntent, setPendingFinishIntent] = useState<PendingFinishIntent>(null);
  const [consentActionBusy, setConsentActionBusy] = useState(false);
  const pendingSignActionRef = useRef<(() => Promise<void>) | null>(null);
  const consentCloseHandledRef = useRef(false);

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
    setIsFinished(false);
    setIsLocked(false);
    setFinishedByName(null);
    setFinishActionError(null);
    setShowConsent(false);
    setPendingFinishIntent(null);
    pendingSignActionRef.current = null;
    consentCloseHandledRef.current = false;
  }, [consultationId]);

  function markFinished(name?: string | null, options?: { reloadRight?: boolean }) {
    const resolvedName = (name || "").trim() || null;
    setIsFinished(true);
    setFinishedByName(resolvedName);
    setIsLocked(true);
    if (options?.reloadRight) onRightReload?.();
  }

  function beginSignConsentFlow(runSign: () => Promise<void>) {
    if (!encounterId || isFinished || consentActionBusy) return;
    setFinishActionError(null);
    pendingSignActionRef.current = runSign;
    setPendingFinishIntent("sign-rx");
    consentCloseHandledRef.current = false;
    setShowConsent(true);
  }

  function beginFinishWithoutRxConsentFlow() {
    if (!encounterId || isFinished || consentActionBusy) return;
    setFinishActionError(null);
    pendingSignActionRef.current = null;
    setPendingFinishIntent("finish-no-rx");
    consentCloseHandledRef.current = false;
    setShowConsent(true);
  }

  function clearPendingAction() {
    setPendingFinishIntent(null);
    pendingSignActionRef.current = null;
    consentCloseHandledRef.current = false;
  }

  async function runPendingActionAfterConsentExit() {
    if (consentActionBusy || !consultationId || !encounterId) return;
    const action = pendingFinishIntent;
    const signAction = pendingSignActionRef.current;
    if (!action) return;

    setConsentActionBusy(true);
    setFinishActionError(null);
    try {
      if (action === "sign-rx") {
        if (signAction) {
          await signAction();
        }
        return;
      }

      const skipFollowupAutoclear = getFollowupAutoclearSkip(consultationId);
      const finalizeRes = await fetch("/api/doctor/consultations/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consultation_id: consultationId,
          encounter_id: encounterId,
          skip_followup_autoclear: skipFollowupAutoclear,
        }),
      });
      const finalizeBody = await finalizeRes.json().catch(() => ({}));
      if (!finalizeRes.ok) {
        setFinishActionError(
          String(finalizeBody?.error || "Unable to finish consultation. Please try again."),
        );
        return;
      }

      markFinished(getPersistedFinishedByName(finalizeBody));
    } catch {
      // keep current UI state; user can retry action
      setFinishActionError("Unable to finish consultation. Please try again.");
    } finally {
      clearPendingAction();
      setConsentActionBusy(false);
    }
  }

  function handleConsentCloseLike() {
    if (consentCloseHandledRef.current) return;
    consentCloseHandledRef.current = true;
    setShowConsent(false);
    void runPendingActionAfterConsentExit();
  }

  useEffect(() => {
    if (!showConsent) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleConsentCloseLike();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showConsent]);

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

          const consultationStatus = String(j?.consultation?.status || "").toLowerCase();
          const prescriptionStatus = String(j?.prescription?.status || "").toLowerCase();
          const finished = consultationStatus === "done" || prescriptionStatus === "signed";
          setIsFinished(finished);
          setIsLocked(finished);
          setFinishedByName(finished ? getPersistedFinishedByName(j) : null);
        }
      } catch {
        // ignore metadata fetch failures
      } finally {
        if (!aborted) setMetaLoading(false);
      }
    }

    void loadMeta();
    return () => {
      aborted = true;
    };
  }, [consultationId, currentDoctorName]);

  // Keep branch in sync with initial defaults (from login/session) and fetched consultation meta
  useEffect(() => {
    if (!consultBranch && defaultBranch) setConsultBranch(defaultBranch);
  }, [defaultBranch, consultBranch]);

  const isFPE = String(consultType || "").toUpperCase() === "FPE";
  const badgeText = consultType ? (isFPE ? "FPE" : "Follow-up") : null;
  const badgeClass = isFPE ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800";

  const canIssueMedCert = Boolean(consultationId && encounterId && !isLocked);
  const finishedByLabel = withDoctorPrefix(finishedByName);

  /*
   * QA notes:
   * - isFinished/isLocked are sourced from persisted consultation/prescription status via /api/claims/preview.
   * - Doctor attribution uses persisted signer fields only (signer.name / consultation.signing_doctor_name / finished_by_name).
   * - Once finish intent is set, consent Save/Cancel/Close all route through one close-like handler that runs the pending action.
   */

  return (
    <section className="space-y-4">
      {!consultationId ? (
        <StartConsultBar patientId={patientId} onStarted={(cid) => setConsultationId(cid)} />
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            {isFinished ? (
              <>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                  Finished
                </span>
                <span>· Finished by {finishedByLabel ?? "Dr. —"}</span>
              </>
            ) : (
              <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                Consultation started
              </span>
            )}

            {badgeText && (
              <span className={`inline-block rounded-full px-2 py-0.5 ${badgeClass}`}>
                {badgeText}
              </span>
            )}
            <span>· ID: {consultationId}</span>
            {metaLoading && <span>· loading...</span>}

            {isFinished && isLocked && (
              <button
                type="button"
                onClick={() => setIsLocked(false)}
                className="ml-auto rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>
            )}
          </div>

          {isFinished && isLocked && (
            <div className="text-xs text-gray-600">
              This consultation is finished. You can edit this workspace freely by tapping
              {" "}
              &lsquo;Edit&rsquo;.
            </div>
          )}
        </div>
      )}

      {medCertToast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {medCertToast}
        </div>
      )}

      {finishActionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {finishActionError}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-sm">
        <fieldset
          disabled={!consultationId || isLocked}
          className={`transition ${!consultationId || isLocked ? "opacity-60" : ""}`}
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
              <h3 className="mb-2 font-medium text-gray-800">Prescription</h3>
              <RxPanel
                patientId={patientId}
                consultationId={consultationId}
                onSignIntent={(runSign) => beginSignConsentFlow(runSign)}
                onSigned={(meta) => {
                  setFinishActionError(null);
                  markFinished(meta?.signerName ?? null);
                }}
              />
            </div>

            <div className="p-4">
              <DiagnosisPanel patientId={patientId} initialConsultationId={consultationId} />
            </div>
          </div>
        </fieldset>

        {consultationId && (
          <FinishConsultButton
            consultationId={consultationId}
            encounterId={encounterId ?? undefined}
            onNeedConsent={beginFinishWithoutRxConsentFlow}
            encounterLoading={metaLoading}
            isFinished={isFinished}
            finishedByName={finishedByName}
          />
        )}
      </div>

      {consultationId && encounterId && (
        <ConsentModal
          isOpen={showConsent}
          onClose={handleConsentCloseLike}
          consultationId={consultationId}
          encounterId={encounterId}
          patientId={patientId}
          onSaved={handleConsentCloseLike}
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
            setMedCertToast(meta?.isEdit ? "Medical certificate updated." : "Medical certificate generated.");
            setShowMedCert(false);
          }}
        />
      )}
    </section>
  );
}

export function ReloadableConsultationSection(
  props: Omit<ConsultationSectionProps, "onRightReload">,
) {
  const [rightReloadKey, setRightReloadKey] = useState(0);

  return (
    <ConsultationSectionInner
      key={rightReloadKey}
      {...props}
      onRightReload={() => setRightReloadKey((k) => k + 1)}
    />
  );
}

export default ConsultationSectionInner;

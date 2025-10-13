"use client";

import { useEffect, useState } from "react";
import StartConsultBar from "./StartConsultBar";
import NotesPanel from "./NotesPanel";
import RxPanel from "./RxPanel";
import BranchPicker from "./BranchPicker";
import FollowUpPanel from "./FollowUpPanel";

export default function ConsultationSection({
  patientId,
  initialConsultationId = null,
}: {
  patientId: string;
  initialConsultationId?: string | null;
}) {
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId);

  useEffect(() => {
    if (initialConsultationId) setConsultationId(initialConsultationId);
  }, [initialConsultationId]);

  return (
    <section className="space-y-4">
      {/* Start / Status */}
      {!consultationId ? (
        <StartConsultBar
          patientId={patientId}
          onStarted={(cid) => setConsultationId(cid)}
        />
      ) : (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
            Consultation started
          </span>
          <span>· ID: {consultationId}</span>
        </div>
      )}

      {/* Main workspace card */}
      <fieldset
        disabled={!consultationId}
        className={`rounded-xl border bg-white shadow-sm transition ${
          !consultationId ? "opacity-60" : ""
        }`}
      >
        {/* Header area */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Consultation Workspace</h2>
          <BranchPicker consultationId={consultationId} initialBranch={null} />
        </div>

        {/* Panels content */}
        <div className="divide-y">
          {/* Follow-Up */}
          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">Follow-Up</h3>
            <FollowUpPanel
              patientId={patientId}
              consultationId={consultationId}
              defaultBranch={undefined}
            />
          </div>

          {/* Doctor Notes */}
          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">Doctor Notes</h3>
            <NotesPanel
              patientId={patientId}
              consultationId={consultationId}
              modeDefault="markdown"
              autosave={false}
            />
          </div>

          {/* Prescription */}
          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">Prescription</h3>
            <RxPanel patientId={patientId} consultationId={consultationId} />
          </div>
        </div>
      </fieldset>
    </section>
  );
}

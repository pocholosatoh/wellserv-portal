"use client";

import { useEffect, useState } from "react";
import StartConsultBar from "./StartConsultBar";
import NotesPanel from "./NotesPanel";
import RxPanel from "./RxPanel";

export default function ConsultationSection({
  patientId,
  initialConsultationId = null,
}: {
  patientId: string;
  initialConsultationId?: string | null;
}) {
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId);

  // If parent ever passes a prepared id, adopt it
  useEffect(() => {
    if (initialConsultationId) setConsultationId(initialConsultationId);
  }, [initialConsultationId]);

  return (
    <section className="space-y-4">
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

      {/* Disable panels until started */}
      <fieldset disabled={!consultationId} className={!consultationId ? "opacity-60" : ""}>
        <div className="mb-6">
          <h3 className="font-medium mb-2">Doctor Notes</h3>
          <NotesPanel
            patientId={patientId}
            consultationId={consultationId}
            modeDefault="markdown"
            autosave={false} // we’ll provide an explicit Save button
          />
        </div>

        <div>
          <h3 className="font-medium mb-2">Prescription</h3>
          <RxPanel patientId={patientId} consultationId={consultationId} />
        </div>
      </fieldset>
    </section>
  );
}

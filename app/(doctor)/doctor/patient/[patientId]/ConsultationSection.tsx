"use client";

import { useEffect, useState } from "react";
import NotesPanel from "./NotesPanel";
import RxPanel from "./RxPanel";

export default function ConsultationSection({ patientId }: { patientId: string }) {
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/consultations/upsert-today", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId }),
        });
        const json = await res.json();
        if (!res.ok || !json?.consultation?.id) {
          setErr(json?.error || "Failed to create or load today's consultation.");
          setConsultationId(null);
        } else {
          setConsultationId(json.consultation.id as string);
        }
      } catch (e) {
        console.error(e);
        setErr("Network error while preparing consultation.");
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  return (
    <div>
      {err && (
        <div className="mb-3 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Notes */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Doctor Notes</h3>
        <NotesPanel patientId={patientId} consultationId={consultationId} />
      </div>

      {/* Prescription */}
      <div>
        <h3 className="font-medium mb-2">Prescription</h3>
        <RxPanel patientId={patientId} consultationId={consultationId} />
      </div>
    </div>
  );
}

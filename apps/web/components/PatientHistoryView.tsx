"use client";

export type PatientHistoryData = {
  chief_complaint?: string | null;
  present_illness_history?: string | null;
  past_medical_history?: string | null;
  past_surgical_history?: string | null;
  allergies_text?: string | null;
  medications_current?: string | null;
  medications?: string | null;
  family_hx?: string | null;
  family_history?: string | null;
};

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export default function PatientHistoryView({
  history,
  emptyLabel = "No patient history available.",
  className = "",
}: {
  history?: PatientHistoryData | null;
  emptyLabel?: string;
  className?: string;
}) {
  const chief = toText(history?.chief_complaint);
  const hpi = toText(history?.present_illness_history);
  const pmh = toText(history?.past_medical_history);
  const psh = toText(history?.past_surgical_history);
  const allergies = toText(history?.allergies_text);
  const meds = toText(history?.medications_current || history?.medications);
  const famHx = toText(history?.family_hx || history?.family_history);

  const entries = [
    { label: "Chief Complaint", value: chief },
    { label: "Present Illness History", value: hpi },
    { label: "Past Medical History", value: pmh },
    { label: "Past Surgical History", value: psh },
    { label: "Allergies", value: allergies },
    { label: "Medications", value: meds },
    { label: "Family History", value: famHx },
  ].filter((entry) => entry.value);

  if (entries.length === 0) {
    if (!emptyLabel) return null;
    return <div className="text-sm text-slate-500">{emptyLabel}</div>;
  }

  return (
    <div className={`text-sm space-y-1 ${className}`}>
      {entries.map((entry) => (
        <div key={entry.label}>
          <span className="font-semibold text-slate-700">{entry.label}:</span>{" "}
          <span className="text-slate-800 whitespace-pre-wrap">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

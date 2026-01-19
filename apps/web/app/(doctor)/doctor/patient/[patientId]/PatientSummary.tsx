import { sbReadPatientById, sbReadLatestVitalsByPatient } from "@/lib/supabase";
import PatientHistoryView from "@/components/PatientHistoryView";
// app/(doctor)/doctor/patient/[patientId]/PatientSummary.tsx
// Server component: fetch and render the summary card

export default async function PatientSummary({ patientId }: { patientId: string }) {
  const [patient, vitals] = await Promise.all([
    sbReadPatientById(patientId),
    sbReadLatestVitalsByPatient(patientId),
  ]);

  if (!patient) {
    return (
      <div className="border rounded p-4">
        <h2 className="font-semibold mb-2">Patient Summary</h2>
        <p className="text-sm text-red-600">Patient not found.</p>
      </div>
    );
  }

  // Derive simple BMI if you have height (ft/in) + weight_kg as text
  const parseReading = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  let ft = parseReading(patient.height_ft) ?? 0;
  let inch = parseReading(patient.height_inch) ?? 0;
  let kg = parseReading(patient.weight_kg) ?? 0;

  if (vitals?.height_cm != null) {
    const totalIn = Number(vitals.height_cm) / 2.54;
    ft = Math.floor(totalIn / 12);
    inch = Math.round(totalIn - ft * 12);
  }
  if (vitals?.weight_kg != null) kg = parseReading(vitals.weight_kg) ?? kg;

  const systolic = parseReading(vitals?.systolic_bp ?? patient.systolic_bp);
  const diastolic = parseReading(vitals?.diastolic_bp ?? patient.diastolic_bp);
  const hr = parseReading(vitals?.hr);
  const rr = parseReading(vitals?.rr);
  const tempC = parseReading(vitals?.temp_c);
  const o2sat = parseReading(vitals?.o2sat);
  const measured = vitals?.measured_at
    ? new Date(vitals.measured_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })
    : null;

  const meters = ft * 0.3048 + inch * 0.0254;
  const bmi = vitals?.bmi ?? (meters > 0 ? kg / (meters * meters) : null);

  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-2">Patient Summary</h2>
      <div className="text-sm space-y-1">
        <div>
          <b>ID:</b> {patient.patient_id}
        </div>
        {patient.full_name && (
          <div>
            <b>Name:</b> {patient.full_name}
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-2">
          <div>
            <b>Sex:</b> {patient.sex || "-"}
          </div>
          <div>
            <b>Age:</b> {patient.age || "-"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <div>
            <b>Height:</b> {ft ? ft : "-"}ft {inch ? inch : "-"}in
          </div>
          <div>
            <b>Weight:</b> {kg > 0 ? `${kg} kg` : patient.weight_kg || "-"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <div>
            <b>Blood Pressure:</b> {systolic && diastolic ? `${systolic}/${diastolic} mmHg` : "-"}
          </div>
          <div>
            <b>BMI:</b> {bmi ? bmi.toFixed(1) : "-"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <div>
            <b>Heart Rate:</b> {hr ? `${hr} bpm` : "-"}
          </div>
          <div>
            <b>Respiratory Rate:</b> {rr ? `${rr}/min` : "-"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <div>
            <b>Temperature:</b> {tempC ? `${tempC} °C` : "-"}
          </div>
          <div>
            <b>O₂ Sat:</b> {o2sat ? `${o2sat}%` : "-"}
          </div>
        </div>
        {measured && (
          <div>
            <b>Last vitals recorded:</b> {measured}
          </div>
        )}
        <PatientHistoryView history={patient} emptyLabel="" />
      </div>
    </div>
  );
}

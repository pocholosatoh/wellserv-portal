import { sbReadPatientById } from "@/lib/supabase";
// app/(doctor)/doctor/patient/[patientId]/PatientSummary.tsx
// Server component: fetch and render the summary card

export default async function PatientSummary({ patientId }: { patientId: string }) {
  const patient = await sbReadPatientById(patientId);

  if (!patient) {
    return (
      <div className="border rounded p-4">
        <h2 className="font-semibold mb-2">Patient Summary</h2>
        <p className="text-sm text-red-600">Patient not found.</p>
      </div>
    );
  }

  // Derive simple BMI if you have height (ft/in) + weight_kg as text
  const ft = Number(patient.height_ft || 0);
  const inch = Number(patient.height_inch || 0);
  const kg = Number(patient.weight_kg || 0);
  const meters = ft * 0.3048 + inch * 0.0254;
  const bmi = meters > 0 ? (kg / (meters * meters)) : null;

  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-2">Patient Summary</h2>
      <div className="text-sm space-y-1">
        <div><b>ID:</b> {patient.patient_id}</div>
        {patient.full_name && <div><b>Name:</b> {patient.full_name}</div>}
        <div className="grid grid-cols-2 gap-x-2">
          <div><b>Sex:</b> {patient.sex || "-"}</div>
          <div><b>Age:</b> {patient.age || "-"}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <div><b>Height:</b> {patient.height_ft || "-"}ft {patient.height_inch || "-"}in</div>
          <div><b>Weight:</b> {patient.weight_kg || "-"} kg</div>
        </div>
        <div><b>BMI:</b> {bmi ? bmi.toFixed(1) : "-"}</div>
        {patient.allergies_text && <div><b>Allergies:</b> {patient.allergies_text}</div>}
        {patient.chief_complaint && <div><b>Chief Complaint:</b> {patient.chief_complaint}</div>}
        {patient.present_illness_history && <div><b>HPI:</b> {patient.present_illness_history}</div>}
        {patient.past_medical_history && <div><b>PMHx:</b> {patient.past_medical_history}</div>}
      </div>
    </div>
  );
}

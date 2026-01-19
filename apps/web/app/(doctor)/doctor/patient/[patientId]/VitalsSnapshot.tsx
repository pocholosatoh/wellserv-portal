import { sbListVitalsByPatient } from "@/lib/supabase";
import VitalsSnapshotView from "@/components/VitalsSnapshotView";

// Staff vitals snapshot: /staff/patienthistory (app/staff/(protected)/patienthistory/page.tsx),
// which uses patient_id from the selected patient record to call /api/staff/vitals.
// Data source: Supabase vitals_snapshots (measured_at, bp, hr, rr, temp_c, height_cm, weight_kg,
// bmi, o2sat, notes, created_by_initials).

const DEFAULT_LIMIT = 20;

export default async function VitalsSnapshot({
  patientId,
  limit = DEFAULT_LIMIT,
}: {
  patientId: string;
  limit?: number;
}) {
  const rows = await sbListVitalsByPatient(patientId, { limit }).catch(() => []);

  return <VitalsSnapshotView snapshots={rows} />;
}

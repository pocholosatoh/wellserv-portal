import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/http";
import { useSession } from "../providers/SessionProvider";

type ApiPrescriptionItem = {
  id: string;
  prescription_id: string;
  med_id?: string | null;
  generic_name?: string | null;
  brand_name?: string | null;
  strength?: string | null;
  form?: string | null;
  route?: string | null;
  dose_amount?: number | null;
  dose_unit?: string | null;
  frequency_code?: string | null;
  duration_days?: number | null;
  quantity?: number | null;
  instructions?: string | null;
};

type ApiPrescription = {
  id: string;
  patient_id: string;
  doctor_id?: string | null;
  consultation_id?: string | null;
  status?: string | null;
  active?: boolean | null;
  is_superseded?: boolean | null;
  doctors?: { display_name?: string | null; credentials?: string | null } | null;
  consultations?: { signing_doctor_name?: string | null } | null;
  created_at: string;
  notes_for_patient?: string | null;
  items?: ApiPrescriptionItem[];
};

type ApiResponse = {
  prescriptions?: ApiPrescription[];
  error?: string;
};

export type MobilePrescriptionItem = {
  drug: string;
  sig: string;
  instructions?: string | null;
};

export type MobilePrescription = {
  id: string;
  patientId: string;
  issuedAt: string;
  doctorName?: string;
  doctorNamePlain?: string;
  notesForPatient?: string | null;
  items: MobilePrescriptionItem[];
};

const FREQ_DICT: Record<string, string> = {
  OD: "once daily",
  QD: "once daily",
  QAM: "every morning",
  QPM: "every evening",
  BID: "twice daily",
  TID: "three times daily",
  QID: "four times daily",
  HS: "at bedtime",
  PRN: "as needed",
};

function describeFrequency(code?: string | null) {
  if (!code) return "";
  const k = String(code).toUpperCase().trim();
  return FREQ_DICT[k] ? `${FREQ_DICT[k]} (${k})` : k;
}

function isActiveSignedPrescription(row: ApiPrescription) {
  const status = String(row.status || "").trim().toLowerCase();
  if (status && status !== "signed") return false;
  if (row.is_superseded === true) return false;
  if (row.active === true || row.is_superseded === false) return true;
  // Backward compatibility: if active/superseded flags are absent, keep previous behavior.
  if (row.active == null && row.is_superseded == null) return !status || status === "signed";
  return false;
}

function prescriptionGroupKey(row: ApiPrescription) {
  if (row.consultation_id) return `consultation:${row.consultation_id}`;
  const day = String(row.created_at || "").slice(0, 10);
  if (day) return `day:${day}`;
  return `id:${row.id}`;
}

function sortByNewest(rows: ApiPrescription[]) {
  return [...rows].sort((a, b) => {
    const aTsRaw = new Date(a.created_at || 0).getTime();
    const bTsRaw = new Date(b.created_at || 0).getTime();
    const aTs = Number.isFinite(aTsRaw) ? aTsRaw : 0;
    const bTs = Number.isFinite(bTsRaw) ? bTsRaw : 0;
    return bTs - aTs;
  });
}

function mapPrescription(row: ApiPrescription): MobilePrescription {
  const items = row.items || [];
  const baseDoctor =
    row.doctors?.display_name || row.consultations?.signing_doctor_name || undefined;
  const doctorName =
    baseDoctor && row.doctors?.credentials
      ? `${baseDoctor}, ${row.doctors.credentials}`
      : baseDoctor;
  return {
    id: row.id,
    patientId: row.patient_id,
    issuedAt: row.created_at,
    doctorName,
    doctorNamePlain: baseDoctor,
    items: items.map((it, idx) => {
      const drug = it?.generic_name || it?.brand_name || it?.med_id || `Medication ${idx + 1}`;

      const friendlyFreq = describeFrequency(it?.frequency_code);

      const parts = [
        it?.strength,
        it?.form,
        it?.route || "PO",
        it?.dose_amount && it?.dose_unit ? `${it.dose_amount} ${it.dose_unit}` : null,
        friendlyFreq,
        it?.duration_days != null ? `${it.duration_days} days` : null,
        it?.quantity != null ? `Qty ${it.quantity}` : null,
      ].filter(Boolean);

      const sig = [parts.join(" · "), it?.instructions || ""].filter(Boolean).join(" — ");

      return {
        drug,
        sig,
        instructions: it?.instructions || null,
      };
    }),
    notesForPatient: row.notes_for_patient ?? null,
  };
}

export function usePatientPrescriptions() {
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;
  const endpoint = "/api/mobile/patient/prescriptions";

  return useQuery<MobilePrescription[]>({
    queryKey: ["prescriptions", patientId],
    enabled: Boolean(patientId) && !isLoading,
    queryFn: async () => {
      if (!patientId) return [];
      let res: Response;
      try {
        res = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({
            patientId,
          }),
        });
      } catch (error) {
        throw error;
      }

      let json: ApiResponse = {};
      try {
        json = (await res.json()) as ApiResponse;
      } catch (error) {
        if (__DEV__) {
          console.warn("[prescriptions] response parse failed", endpoint, res.status);
        }
      }

      if (!res.ok || json.error) {
        if (__DEV__) {
          console.warn("[prescriptions] request failed", endpoint, res.status);
        }
        const err = new Error(json.error || "Failed to load prescriptions") as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }

      const rows = json.prescriptions ?? [];
      const filtered = rows.filter((row) => {
        const hasFilterFields =
          row.status != null || row.active != null || row.is_superseded != null;
        if (!hasFilterFields) return true;
        return isActiveSignedPrescription(row);
      });

      const deduped = new Map<string, ApiPrescription>();
      for (const row of sortByNewest(filtered)) {
        const key = prescriptionGroupKey(row);
        if (!deduped.has(key)) deduped.set(key, row);
      }

      return Array.from(deduped.values()).map(mapPrescription);
    },
  });
}

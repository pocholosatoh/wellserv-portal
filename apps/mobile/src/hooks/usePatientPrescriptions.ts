import { useQuery } from "@tanstack/react-query";
import type { Prescription } from "@wellserv/core";
import { getApiBaseUrl } from "../lib/api";
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
  doctors?: { display_name?: string | null; credentials?: string | null } | null;
  consultations?: { signing_doctor_name?: string | null } | null;
  created_at: string;
  items?: ApiPrescriptionItem[];
};

type ApiResponse = {
  prescriptions?: ApiPrescription[];
  error?: string;
};

type MobilePrescription = Prescription & { doctorName?: string };

function mapPrescription(row: ApiPrescription): MobilePrescription {
  const items = row.items || [];
  const baseDoctor = row.doctors?.display_name || row.consultations?.signing_doctor_name || undefined;
  const doctorName =
    baseDoctor && row.doctors?.credentials
      ? `${baseDoctor}, ${row.doctors.credentials}`
      : baseDoctor;
  return {
    id: row.id,
    patientId: row.patient_id,
    issuedAt: row.created_at,
    doctorName,
    items: items.map((it, idx) => {
      const drug =
        it?.generic_name ||
        it?.brand_name ||
        it?.med_id ||
        `Medication ${idx + 1}`;

      const parts = [
        it?.strength,
        it?.form,
        it?.route || "PO",
        it?.dose_amount && it?.dose_unit ? `${it.dose_amount} ${it.dose_unit}` : null,
        it?.frequency_code,
        it?.duration_days != null ? `${it.duration_days} days` : null,
        it?.quantity != null ? `Qty ${it.quantity}` : null,
      ].filter(Boolean);

      const sig = [parts.join(" · "), it?.instructions || ""].filter(Boolean).join(" — ");

      return {
        drug,
        sig,
      };
    }),
  };
}

export function usePatientPrescriptions() {
  const { session } = useSession();
  const patientId = session?.patientId;

  return useQuery<Prescription[]>({
    queryKey: ["prescriptions", patientId],
    enabled: Boolean(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) {
        throw new Error("API base URL not configured");
      }
      const url = `${baseUrl}/api/mobile/patient/prescriptions`;
      console.warn("PRESCRIPTIONS REQUEST URL:", url);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            patientId,
          }),
        });
      } catch (error) {
        console.warn("PRESCRIPTIONS ERROR:", error);
        throw error;
      }

      let json: ApiResponse = {};
      try {
        json = (await res.json()) as ApiResponse;
      } catch (error) {
        console.warn("PRESCRIPTIONS ERROR parsing response:", error);
      }

      if (!res.ok || json.error) {
        console.warn("PRESCRIPTIONS ERROR RESPONSE:", {
          status: res.status,
          statusText: res.statusText,
          body: json,
        });
        throw new Error(json.error || "Failed to load prescriptions");
      }

      return (json.prescriptions ?? []).map(mapPrescription);
    },
  });
}

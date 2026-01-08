import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { prescriptionSchema, type Prescription } from "@wellserv/core";
import { getApiFetcher, type ApiClientOptions } from "./apiClient";

type ApiPrescriptionItem = {
  med_id?: string | null;
  generic_name?: string | null;
  brand_name?: string | null;
  instructions?: string | null;
};

type ApiPrescription = {
  id: string;
  patient_id: string;
  created_at: string;
  items?: ApiPrescriptionItem[];
};

type ApiResponse = {
  prescriptions?: ApiPrescription[];
  error?: string;
};

type UsePrescriptionsOptions = ApiClientOptions;

function mapPrescription(row: ApiPrescription): Prescription {
  return prescriptionSchema.parse({
    id: row.id,
    patientId: row.patient_id,
    issuedAt: row.created_at,
    items: (row.items ?? []).map((item, index) => ({
      drug:
        item.generic_name ||
        item.brand_name ||
        item.med_id ||
        `Medication ${index + 1}`,
      sig: item.instructions ?? "",
    })),
  });
}

export function usePrescriptions(
  _client: SupabaseClient | null,
  patientId?: string,
  options?: UsePrescriptionsOptions,
) {
  return useQuery<Prescription[]>({
    queryKey: ["prescriptions", patientId],
    enabled: Boolean(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      const apiFetch = getApiFetcher(options);
      const res = await apiFetch("/api/mobile/patient/prescriptions", {
        method: "POST",
        body: JSON.stringify({ patientId }),
      });

      let json: ApiResponse = {};
      try {
        json = (await res.json()) as ApiResponse;
      } catch {
        // noop
      }

      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to load prescriptions");
      }

      return (json.prescriptions ?? []).map(mapPrescription);
    },
  });
}

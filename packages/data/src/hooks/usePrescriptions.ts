import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { prescriptionSchema, type Prescription } from "@wellserv/core";

type RawPrescription = {
  id: string;
  patient_id: string;
  created_at: string;
  prescription_items?: Array<{
    drug_name: string;
    instructions?: string | null;
  }>;
};

function mapPrescription(row: RawPrescription): Prescription {
  return prescriptionSchema.parse({
    id: row.id,
    patientId: row.patient_id,
    issuedAt: row.created_at,
    items: (row.prescription_items ?? []).map((item) => ({
      drug: item.drug_name,
      sig: item.instructions ?? "",
    })),
  });
}

export function usePrescriptions(client: SupabaseClient | null, patientId?: string) {
  return useQuery<Prescription[]>({
    queryKey: ["prescriptions", patientId],
    enabled: Boolean(client && patientId),
    queryFn: async () => {
      if (!client || !patientId) return [];
      const { data, error } = await client
        .from("prescriptions")
        .select("id, patient_id, created_at, prescription_items(drug_name, instructions)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPrescription);
    },
  });
}

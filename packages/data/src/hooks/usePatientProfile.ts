import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { patientSchema, type Patient } from "@wellserv/core";

export function usePatientProfile(client: SupabaseClient | null, patientId?: string) {
  return useQuery<Patient>({
    queryKey: ["patient-profile", patientId],
    enabled: Boolean(client && patientId),
    queryFn: async () => {
      if (!client || !patientId) throw new Error("Missing patient");
      const { data, error } = await client
        .from("patients")
        .select("patient_id, full_name, birthday, last_updated")
        .eq("patient_id", patientId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Patient not found");
      return patientSchema.parse({
        id: data.patient_id,
        fullName: data.full_name,
        birthDate: data.birthday,
        lastVisit: data.last_updated,
      });
    },
  });
}

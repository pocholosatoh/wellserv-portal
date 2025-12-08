import { useQuery } from "@tanstack/react-query";
import { useSession } from "../providers/SessionProvider";

export type PatientDeliveryInfo = {
  patient_id: string;
  full_name: string | null;
  delivery_address_label: string | null;
  delivery_address_text: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  last_delivery_used_at: string | null;
  last_delivery_success_at: string | null;
};

export function useDeliveryInfo() {
  const { client, session, isLoading } = useSession();
  const patientId = session?.patientId;

  return useQuery<PatientDeliveryInfo | null>({
    queryKey: ["delivery-info", patientId],
    enabled: Boolean(client && patientId) && !isLoading,
    queryFn: async () => {
      if (!client || !patientId) return null;
      const { data, error } = await client
        .from("patients")
        .select(
          "patient_id, full_name, delivery_address_label, delivery_address_text, delivery_lat, delivery_lng, delivery_notes, last_delivery_used_at, last_delivery_success_at"
        )
        .eq("patient_id", patientId)
        .maybeSingle();
      if (error) throw error;
      return (data as PatientDeliveryInfo | null) ?? null;
    },
  });
}

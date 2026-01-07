import { useQuery } from "@tanstack/react-query";
import { useSession } from "../providers/SessionProvider";
import { apiFetch } from "../lib/http";

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
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;

  return useQuery<PatientDeliveryInfo | null>({
    queryKey: ["delivery-info", patientId],
    enabled: Boolean(patientId) && !isLoading,
    queryFn: async () => {
      if (!patientId) return null;
      try {
        const res = await apiFetch("/api/mobile/patient/delivery-address", { method: "GET" });
        let json: { patient?: PatientDeliveryInfo | null; error?: string } = {};
        try {
          json = (await res.json()) as { patient?: PatientDeliveryInfo | null; error?: string };
        } catch (error) {
          if (__DEV__) {
            console.warn("[delivery-info] response parse failed", res.status);
          }
        }
        if (!res.ok || json.error) {
          throw new Error(json.error || "Failed to load delivery info");
        }
        return json.patient ?? null;
      } catch (error) {
        throw error;
      }
    },
  });
}

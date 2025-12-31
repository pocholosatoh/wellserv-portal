import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/http";
import { useSession } from "../providers/SessionProvider";

export type VitalsSnapshot = {
  id: string;
  patient_id?: string;
  encounter_id?: string;
  consultation_id?: string | null;
  measured_at: string;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  weight_kg?: number | null;
  blood_glucose_mgdl?: number | null;
  source?: string | null;
  created_by_initials?: string | null;
};

type ApiResponse = {
  vitals?: VitalsSnapshot[];
  error?: string;
};

export function usePatientVitals(parameterKey: string, limit = 10) {
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;
  const endpoint = `/api/mobile/patient/vitals?parameter_key=${encodeURIComponent(
    parameterKey,
  )}&limit=${limit}`;

  return useQuery<VitalsSnapshot[]>({
    queryKey: ["patient-vitals", patientId, parameterKey, limit],
    enabled: Boolean(patientId) && !isLoading && Boolean(parameterKey),
    queryFn: async () => {
      let res: Response;
      try {
        res = await apiFetch(endpoint, { method: "GET" });
      } catch (error) {
        throw error;
      }

      let json: ApiResponse = {};
      try {
        json = (await res.json()) as ApiResponse;
      } catch (error) {
        if (__DEV__) {
          console.warn("[vitals] response parse failed", endpoint, res.status);
        }
      }

      if (!res.ok || json.error) {
        if (__DEV__) {
          console.warn("[vitals] request failed", endpoint, res.status);
        }
        const err = new Error(json.error || "Failed to load vitals") as Error & { status?: number };
        err.status = res.status;
        throw err;
      }

      return json.vitals ?? [];
    },
  });
}

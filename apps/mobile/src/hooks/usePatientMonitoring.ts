import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/http";
import { useSession } from "../providers/SessionProvider";

export type PatientMonitoringRow = {
  id?: string;
  patient_id?: string | null;
  parameter_key?: string | null;
  parameter?: string | null;
  param_key?: string | null;
  enabled?: boolean | null;
  is_enabled?: boolean | null;
  instructions?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
};

type ApiResponse = {
  monitoring?: PatientMonitoringRow[];
  error?: string;
};

export function usePatientMonitoring() {
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;
  const endpoint = "/api/mobile/patient/monitoring";

  return useQuery<PatientMonitoringRow[]>({
    queryKey: ["patient-monitoring", patientId],
    enabled: Boolean(patientId) && !isLoading,
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
          console.warn("[monitoring] response parse failed", endpoint, res.status);
        }
      }

      if (!res.ok || json.error) {
        if (__DEV__) {
          console.warn("[monitoring] request failed", endpoint, res.status);
        }
        const err = new Error(json.error || "Failed to load monitoring") as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }

      return json.monitoring ?? [];
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/http";
import { useSession } from "../providers/SessionProvider";

type ApiResponse = {
  hasConsultationHistory?: boolean;
  error?: string;
};

export function useHasConsultationHistory() {
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;
  const endpoint = "/api/mobile/patient/consultations/has-history";

  return useQuery<{ hasConsultationHistory: boolean }>({
    queryKey: ["consultations", "has-history", patientId],
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
          console.warn("[consultations/has-history] response parse failed", endpoint, res.status);
        }
      }

      if (!res.ok || json.error) {
        if (__DEV__) {
          console.warn("[consultations/has-history] request failed", endpoint, res.status);
        }
        const err = new Error(json.error || "Failed to load consultation history") as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }

      return { hasConsultationHistory: Boolean(json.hasConsultationHistory) };
    },
  });
}

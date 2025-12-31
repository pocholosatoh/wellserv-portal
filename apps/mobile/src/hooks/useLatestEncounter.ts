import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/http";
import { useSession } from "../providers/SessionProvider";

type ApiResponse = {
  encounter_id?: string | null;
  error?: string;
};

export function useLatestEncounter() {
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;
  const endpoint = "/api/mobile/patient/latest-encounter";

  return useQuery<{ encounterId: string | null }>({
    queryKey: ["latest-encounter", patientId],
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
          console.warn("[latest-encounter] response parse failed", endpoint, res.status);
        }
      }

      if (!res.ok || json.error) {
        if (__DEV__) {
          console.warn("[latest-encounter] request failed", endpoint, res.status);
        }
        const err = new Error(json.error || "Failed to load latest encounter") as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }

      return { encounterId: json.encounter_id ?? null };
    },
  });
}

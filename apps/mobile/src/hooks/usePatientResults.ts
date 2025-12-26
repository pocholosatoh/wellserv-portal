import { useQuery } from "@tanstack/react-query";
import { useSession } from "../providers/SessionProvider";
import { apiFetch } from "../lib/http";
import type { PatientResultsResponse, Report } from "../../../shared/types/patient-results";

type UsePatientResultsOptions = {
  limit?: number;
};

export function usePatientResults(options: UsePatientResultsOptions = {}) {
  // Patient identity comes from SessionProvider after login.
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;
  const endpoint = "/api/mobile/patient-results";

  const query = useQuery<PatientResultsResponse>({
    queryKey: ["patient-results", patientId, options.limit],
    enabled: Boolean(patientId) && !isLoading,
    queryFn: async () => {
      if (!patientId) throw new Error("Missing patient");

      // Call the web app API (mobile variant) so we reuse buildAllReports/adaptReportForUI.
      let res: Response;
      try {
        res = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({
            patientId,
            limit: options.limit,
          }),
        });
      } catch (error) {
        throw error;
      }

      let json: PatientResultsResponse & { error?: string } = { reports: [], config: {} };
      try {
        json = (await res.json()) as PatientResultsResponse & { error?: string };
      } catch (error) {
        if (__DEV__) {
          console.warn("[lab results] response parse failed", endpoint, res.status);
        }
      }

      if (!res.ok || json.error) {
        if (__DEV__) {
          console.warn("[lab results] request failed", endpoint, res.status);
        }
        const err = new Error(json.error || "Failed to load results") as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }

      return json;
    },
  });

  return {
    reports: query.data?.reports ?? ([] as Report[]),
    config: query.data?.config,
    patientOnly: query.data?.patientOnly,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? String(query.error?.message || query.error) : null,
    refetch: query.refetch,
  };
}

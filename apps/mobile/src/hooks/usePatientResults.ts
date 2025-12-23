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

  const query = useQuery<PatientResultsResponse>({
    queryKey: ["patient-results", patientId, options.limit],
    enabled: Boolean(patientId) && !isLoading,
    queryFn: async () => {
      if (!patientId) throw new Error("Missing patient");
      console.warn("LAB RESULTS REQUEST URL:", "/api/mobile/patient-results");

      // Call the web app API (mobile variant) so we reuse buildAllReports/adaptReportForUI.
      let res: Response;
      try {
        res = await apiFetch("/api/mobile/patient-results", {
          method: "POST",
          body: JSON.stringify({
            patientId,
            limit: options.limit,
          }),
        });
      } catch (error) {
        console.warn("LAB RESULTS ERROR:", error);
        throw error;
      }

      let json: PatientResultsResponse & { error?: string } = { reports: [], config: {} };
      try {
        json = (await res.json()) as PatientResultsResponse & { error?: string };
      } catch (error) {
        console.warn("LAB RESULTS ERROR parsing response:", error);
      }

      if (!res.ok || json.error) {
        console.warn("LAB RESULTS ERROR RESPONSE:", {
          status: res.status,
          statusText: res.statusText,
          body: json,
        });
        throw new Error(json.error || "Failed to load results");
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

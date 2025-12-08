import { useQuery } from "@tanstack/react-query";
import { useSession } from "../providers/SessionProvider";
import { getApiBaseUrl } from "../lib/api";
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
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) {
        throw new Error("API base URL not configured");
      }
      const url = `${baseUrl}/api/mobile/patient-results`;
      console.warn("LAB RESULTS REQUEST URL:", url);

      // Call the web app API (mobile variant) so we reuse buildAllReports/adaptReportForUI.
      let res: Response;
      try {
        const cookieHeader = `role=patient; patient_id=${encodeURIComponent(patientId)}`;
        res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // RN fetch does not always persist the cookie jar; send an explicit session cookie.
            cookie: cookieHeader,
          },
          credentials: "include",
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

import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { labResultSchema, type LabResult } from "@wellserv/core";
import { getApiFetcher, type ApiClientOptions } from "./apiClient";

type PatientResultsItem = {
  key?: string | null;
  label?: string | null;
  value?: string | null;
  unit?: string | null;
};

type PatientResultsSection = {
  items?: PatientResultsItem[] | null;
};

type PatientResultsReport = {
  patient?: {
    patient_id?: string | null;
  };
  visit?: {
    date_of_test?: string | null;
  };
  sections?: PatientResultsSection[] | null;
};

type PatientResultsResponse = {
  reports?: PatientResultsReport[];
  error?: string;
};

type UseLabResultsOptions = ApiClientOptions;

function mapLabResult(
  report: PatientResultsReport,
  item: PatientResultsItem,
  fallbackPatientId: string,
  index: number,
): LabResult {
  const name = item.label || item.key || `Result ${index + 1}`;
  const collectedAt = report.visit?.date_of_test || "";
  const summaryValue = [item.value, item.unit].filter(Boolean).join(" ").trim();
  const key = item.key || item.label || `item-${index + 1}`;
  return labResultSchema.parse({
    id: `${collectedAt || "unknown"}:${key}`,
    patientId: report.patient?.patient_id || fallbackPatientId,
    name,
    collectedAt,
    summary: summaryValue || undefined,
  });
}

export function useLabResults(
  _client: SupabaseClient | null,
  patientId?: string,
  options?: UseLabResultsOptions,
) {
  return useQuery<LabResult[]>({
    queryKey: ["lab-results", patientId],
    enabled: Boolean(patientId),
    queryFn: async () => {
      if (!patientId) return [];
      const apiFetch = getApiFetcher(options);
      const res = await apiFetch("/api/mobile/patient-results", {
        method: "POST",
        body: JSON.stringify({ patientId }),
      });

      let json: PatientResultsResponse = {};
      try {
        json = (await res.json()) as PatientResultsResponse;
      } catch {
        // noop
      }

      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to load lab results");
      }

      const reports = json.reports ?? [];
      const results: LabResult[] = [];
      for (const report of reports) {
        const sections = report.sections ?? [];
        for (const section of sections) {
          const items = section?.items ?? [];
          for (const [index, item] of items.entries()) {
            if (!item?.value) continue;
            results.push(mapLabResult(report, item, patientId, index));
          }
        }
      }
      return results;
    },
  });
}

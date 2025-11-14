import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { labResultSchema, type LabResult } from "@wellserv/core";

type RawLabResult = {
  result_id: string;
  patient_id: string;
  analyte: string;
  date_of_test: string;
  pdf_url?: string | null;
  impression?: string | null;
};

function mapLabResult(row: RawLabResult): LabResult {
  return labResultSchema.parse({
    id: row.result_id,
    patientId: row.patient_id,
    name: row.analyte,
    collectedAt: row.date_of_test,
    pdfUrl: row.pdf_url ?? undefined,
    summary: row.impression ?? undefined,
  });
}

export function useLabResults(client: SupabaseClient | null, patientId?: string) {
  return useQuery<LabResult[]>({
    queryKey: ["lab-results", patientId],
    enabled: Boolean(client && patientId),
    queryFn: async () => {
      if (!client || !patientId) return [];
      const { data, error } = await client
        .from("results_wide")
        .select("result_id, patient_id, analyte, date_of_test, pdf_url, impression")
        .eq("patient_id", patientId)
        .order("date_of_test", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapLabResult);
    },
  });
}

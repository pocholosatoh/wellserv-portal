import { useQuery } from "@tanstack/react-query";
import { useSession } from "../providers/SessionProvider";
import { apiFetch } from "../lib/http";

export type OtherLabItem = {
  id: string;
  patient_id: string;
  url: string;
  content_type: string | null;
  type: string | null;
  provider?: string | null;
  taken_at?: string | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  note?: string | null;
  category?: string | null;
  subtype?: string | null;
  impression?: string | null;
  reported_at?: string | null;
  performer_name?: string | null;
  performer_role?: string | null;
  performer_license?: string | null;
  encounter_id?: string | null;
};

export function useOtherLabsUploads() {
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;
  const endpoint = "/api/mobile/other-labs";

  const query = useQuery<OtherLabItem[]>({
    queryKey: ["other-labs", patientId],
    enabled: Boolean(patientId) && !isLoading,
    queryFn: async () => {
      if (!patientId) throw new Error("Missing patient");

      const res = await apiFetch(endpoint, { method: "GET" });
      let json: OtherLabItem[] & { error?: string } = [];
      try {
        json = (await res.json()) as OtherLabItem[] & { error?: string };
      } catch (error) {
        if (__DEV__) {
          console.warn("[other labs] response parse failed", endpoint, res.status);
        }
      }

      if (!res.ok || (json as { error?: string })?.error) {
        if (__DEV__) {
          console.warn("[other labs] request failed", endpoint, res.status);
        }
        const err = new Error(
          (json as { error?: string })?.error || "Failed to load other labs"
        ) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }

      return Array.isArray(json) ? json : [];
    },
  });

  return {
    data: query.data ?? [],
    loading: query.isLoading || query.isFetching,
    error: query.error ? String(query.error?.message || query.error) : null,
    refresh: query.refetch,
  };
}

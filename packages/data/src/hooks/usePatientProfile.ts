import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { patientSchema, type Patient } from "@wellserv/core";
import { getApiFetcher, type ApiClientOptions } from "./apiClient";

type SessionSnapshot = {
  patientId?: string | null;
  fullName?: string | null;
  birthday?: string | null;
  lastUpdated?: string | null;
};

type PatientResultsResponse = {
  reports?: Array<{
    patient?: {
      patient_id?: string | null;
      full_name?: string | null;
      birthday?: string | null;
      last_updated?: string | null;
    };
  }>;
  error?: string;
};

type UsePatientProfileOptions = ApiClientOptions & {
  session?: SessionSnapshot | null;
};

function normalizeId(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

export function usePatientProfile(
  _client: SupabaseClient | null,
  patientId?: string,
  options?: UsePatientProfileOptions,
) {
  return useQuery<Patient>({
    queryKey: ["patient-profile", patientId],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const normalizedId = normalizeId(patientId);
      if (!normalizedId) throw new Error("Missing patient");

      const session = options?.session || null;
      if (session) {
        const sessionId = normalizeId(session.patientId);
        if (!sessionId || sessionId === normalizedId) {
          return patientSchema.parse({
            id: normalizedId,
            fullName: session.fullName ?? "",
            birthDate: session.birthday ?? undefined,
            lastVisit: session.lastUpdated ?? undefined,
          });
        }
      }

      const apiFetch = getApiFetcher(options);
      const timeoutMs = 12_000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          const err = new Error("Request timed out");
          err.name = "TimeoutError";
          reject(err);
        }, timeoutMs);
      });

      try {
        const res = (await Promise.race([
          apiFetch("/api/mobile/patient-results", {
            method: "POST",
            body: JSON.stringify({ patientId: normalizedId, limit: 1 }),
          }),
          timeoutPromise,
        ])) as Response;

        let json: PatientResultsResponse = {};
        try {
          json = (await res.json()) as PatientResultsResponse;
        } catch {
          // noop
        }

        if (!res.ok || json.error) {
          throw new Error(json.error || "Failed to load patient profile");
        }

        const patient = json.reports?.[0]?.patient;
        if (!patient?.patient_id) throw new Error("Patient not found");
        return patientSchema.parse({
          id: patient.patient_id,
          fullName: patient.full_name || "",
          birthDate: patient.birthday || undefined,
          lastVisit: patient.last_updated || undefined,
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { useSession } from "../providers/SessionProvider";
import { getApiBaseUrl } from "../lib/api";

type ApiFollowup = {
  id: string;
  patient_id: string;
  return_branch: string | null;
  due_date: string;
  valid_until?: string | null;
  intended_outcome?: string | null;
  expected_tests?: string | null;
  status: "scheduled" | "completed" | "canceled" | "skipped";
  doctor_name?: string | null;
  doctor_name_plain?: string | null;
};

type ApiResponse = {
  followup?: ApiFollowup | null;
  error?: string;
};

export type PatientFollowup = {
  id: string;
  patientId: string;
  dueDate: string;
  returnBranch: string | null;
  returnBranchLabel: string | null;
  intendedOutcome: string | null;
  expectedTestsRaw: string | null;
  expectedTests: string[];
  status: ApiFollowup["status"];
  doctorName?: string | null;
  doctorNamePlain?: string | null;
};

function parseExpected(raw?: string | null) {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatBranchLabel(branch?: string | null) {
  if (!branch) return null;
  const raw = branch.trim();
  const up = raw.toUpperCase();
  if (up === "SI") return "San Isidro Hub";
  if (up === "SL") return "San Leonardo Hub";
  if (/san\s*isidro/i.test(raw)) return "San Isidro Hub";
  if (/san\s*leonardo/i.test(raw)) return "San Leonardo Hub";
  return raw;
}

function mapFollowup(row: ApiFollowup): PatientFollowup {
  return {
    id: row.id,
    patientId: row.patient_id,
    dueDate: row.due_date,
    returnBranch: row.return_branch,
    returnBranchLabel: formatBranchLabel(row.return_branch),
    intendedOutcome: row.intended_outcome ?? null,
    expectedTestsRaw: row.expected_tests ?? null,
    expectedTests: parseExpected(row.expected_tests),
    status: row.status,
    doctorName: row.doctor_name ?? row.doctor_name_plain ?? null,
    doctorNamePlain: row.doctor_name_plain ?? row.doctor_name ?? null,
  };
}

export function usePatientFollowups() {
  const { session, isLoading } = useSession();
  const patientId = session?.patientId;

  const query = useQuery<PatientFollowup | null>({
    queryKey: ["followups", patientId],
    enabled: Boolean(patientId) && !isLoading,
    queryFn: async () => {
      if (!patientId) return null;
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) {
        throw new Error("API base URL not configured");
      }
      const url = `${baseUrl}/api/mobile/patient/followups`;
      const cookieHeader = `role=patient; patient_id=${encodeURIComponent(patientId)}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: cookieHeader,
          },
          credentials: "include",
          body: JSON.stringify({ patientId }),
        });
      } catch (error) {
        console.warn("FOLLOW-UPS ERROR:", error);
        throw error;
      }

      let json: ApiResponse = {};
      try {
        json = (await res.json()) as ApiResponse;
      } catch (error) {
        console.warn("FOLLOW-UPS ERROR parsing response:", error);
      }

      if (!res.ok || json.error) {
        console.warn("FOLLOW-UPS ERROR RESPONSE:", {
          status: res.status,
          statusText: res.statusText,
          body: json,
        });
        throw new Error(json.error || "Failed to load follow-ups");
      }

      return json.followup ? mapFollowup(json.followup) : null;
    },
  });

  return {
    followup: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? String(query.error?.message || query.error) : null,
    refetch: query.refetch,
  };
}

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/http";

export type Hub = {
  code: string;
  name: string;
  address: string | null;
  contact: string | null;
};

export async function fetchHubs(): Promise<Hub[]> {
  const res = await apiFetch("/api/mobile/hubs");
  if (!res.ok) {
    const err = new Error("Failed to load hubs") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  try {
    return ((await res.json()) as Hub[]) ?? [];
  } catch (error) {
    console.warn("[apiFetch] JSON_PARSE_ERROR", error);
    throw error;
  }
}

export function useHubs() {
  return useQuery<Hub[]>({
    queryKey: ["hubs"],
    queryFn: fetchHubs,
  });
}

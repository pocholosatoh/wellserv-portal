import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "../lib/api";

export type Hub = {
  code: string;
  name: string;
  address: string | null;
  contact: string | null;
};

export async function fetchHubs(): Promise<Hub[]> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API base URL not configured");
  }
  const res = await fetch(`${baseUrl}/api/mobile/hubs`);
  if (!res.ok) throw new Error("Failed to load hubs");
  return ((await res.json()) as Hub[]) ?? [];
}

export function useHubs() {
  return useQuery<Hub[]>({
    queryKey: ["hubs"],
    queryFn: fetchHubs,
  });
}

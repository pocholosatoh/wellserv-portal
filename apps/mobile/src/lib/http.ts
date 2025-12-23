import { getStoredSessionToken } from "./sessionStorage";

export async function apiFetch(path: string, init?: RequestInit) {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  if (__DEV__) console.log("[apiFetch]", init?.method ?? "GET", url);

  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const token = await getStoredSessionToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: init?.credentials ?? "include",
      headers,
    });
  } catch (e) {
    console.warn("[apiFetch] NETWORK_ERROR", url, e);
    throw e;
  }

  if (__DEV__) {
    const ct = res.headers.get("content-type") || "";
    console.log("[apiFetch] status", res.status, "content-type", ct);
  }

  return res;
}

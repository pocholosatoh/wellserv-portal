import { getStoredSessionToken, notifySessionExpired } from "./sessionStorage";

type ApiFetchInit = RequestInit & {
  timeoutMs?: number;
};

export async function apiFetch(path: string, init?: ApiFetchInit) {
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

  const timeoutMs = init?.timeoutMs ?? 12000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: init?.credentials ?? "include",
      signal: controller.signal,
      headers,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn("[apiFetch] NETWORK_ERROR", url, e);
    throw e;
  }
  clearTimeout(timeoutId);

  if (__DEV__) {
    const ct = res.headers.get("content-type") || "";
    console.log("[apiFetch] status", res.status, "content-type", ct);
  }

  if (token && (res.status === 401 || res.status === 403)) {
    notifySessionExpired();
  }

  return res;
}

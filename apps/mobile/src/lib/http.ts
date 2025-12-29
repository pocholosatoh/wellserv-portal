import { getStoredSessionToken, notifySessionExpired } from "./sessionStorage";

type ApiFetchInit = RequestInit & {
  timeoutMs?: number;
};

let baseUrlLogged = false;
let devBaseWarned = false;

function isValidBaseUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function apiFetch(path: string, init?: ApiFetchInit) {
  const devBase = process.env.EXPO_PUBLIC_DEV_API_BASE_URL?.replace(/\/$/, "") || "";
  const prodBase = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  const devValid = devBase && isValidBaseUrl(devBase);
  if (__DEV__ && devBase && !devValid && !devBaseWarned) {
    devBaseWarned = true;
    console.warn(
      "[apiFetch] EXPO_PUBLIC_DEV_API_BASE_URL ignored; must start with http:// or https://"
    );
  }

  const base = __DEV__ && devValid ? devBase : prodBase;
  if (!isValidBaseUrl(base)) {
    throw new Error(
      "API base URL missing or invalid. Set EXPO_PUBLIC_API_BASE_URL to a full http(s) URL."
    );
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;

  const method = init?.method?.toUpperCase() ?? "GET";
  if (__DEV__) console.log("[apiFetch]", method, url);
  if (__DEV__ && !baseUrlLogged) {
    baseUrlLogged = true;
    console.log("[apiFetch] base URL", base || "(empty)");
  }

  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const hasBody = init?.body != null;
  if (!headers.has("Content-Type") && (hasBody || method !== "GET")) {
    headers.set("Content-Type", "application/json");
  }

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

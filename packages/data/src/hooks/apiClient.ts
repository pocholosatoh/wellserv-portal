export type ApiFetchInit = RequestInit & {
  timeoutMs?: number;
};

export type ApiFetcher = (path: string, init?: ApiFetchInit) => Promise<Response>;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;
declare const __DEV__: boolean | undefined;

export type ApiClientOptions = {
  fetcher?: ApiFetcher;
  baseUrl?: string;
  token?: string | null;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function isValidBaseUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function resolveBaseUrl(override?: string) {
  if (override) return normalizeBaseUrl(override);
  const devBase = normalizeBaseUrl(process?.env?.EXPO_PUBLIC_DEV_API_BASE_URL || "");
  const prodBase = normalizeBaseUrl(process?.env?.EXPO_PUBLIC_API_BASE_URL || "");
  const isDev = Boolean(__DEV__ && devBase && isValidBaseUrl(devBase));
  return isDev ? devBase : prodBase;
}

export function getApiFetcher(options?: ApiClientOptions): ApiFetcher {
  if (options?.fetcher) return options.fetcher;
  const baseUrl = resolveBaseUrl(options?.baseUrl);
  if (!baseUrl || !isValidBaseUrl(baseUrl)) {
    throw new Error("API base URL missing or invalid");
  }

  return async (path, init) => {
    const { timeoutMs: _timeoutMs, ...rest } = init ?? {};
    const headers = new Headers(rest.headers ?? {});
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    const method = rest.method?.toUpperCase() ?? "GET";
    const hasBody = rest.body != null;
    if (!headers.has("Content-Type") && (hasBody || method !== "GET")) {
      headers.set("Content-Type", "application/json");
    }
    if (options?.token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${options.token}`);
    }

    const normalizedPath =
      path.startsWith("http://") || path.startsWith("https://")
        ? path
        : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    return fetch(normalizedPath, {
      ...rest,
      credentials: rest.credentials ?? "include",
      headers,
    });
  };
}

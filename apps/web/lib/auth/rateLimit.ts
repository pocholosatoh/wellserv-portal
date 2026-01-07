export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  key: string;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

type RateLimiterBackendName = "memory" | "upstash" | "vercel-kv" | "supabase";

type RateLimiterBackend = {
  name: RateLimiterBackendName;
  check: (opts: RateLimitOptions) => Promise<RateLimitResult>;
};

type RedisConfig = {
  url: string;
  token: string;
};

const memoryBuckets = new Map<string, RateBucket>();
const memoryBackend: RateLimiterBackend = {
  name: "memory",
  check: async (opts) => checkMemoryLimit(opts),
};

let backendPromise: Promise<RateLimiterBackend> | null = null;
let backendName: RateLimiterBackendName | null = null;
let backendWarned = false;

export function getRequestIp(req: Request) {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for") || "";
  const realIp =
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-client-ip") ||
    headers.get("x-forwarded-for");
  if (realIp) return realIp.split(",")[0].trim();
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function checkMemoryLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = memoryBuckets.get(opts.key);

  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, resetAt: now + opts.windowMs };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count, resetAt: existing.resetAt };
}

function getUpstashConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  return null;
}

function getVercelKvConfig(): RedisConfig | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) return { url, token };
  return null;
}

function hasSupabaseConfig(): boolean {
  return !!(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE)
  );
}

function shouldUseSupabaseFallback(): boolean {
  return process.env.NODE_ENV === "production" && hasSupabaseConfig();
}

async function createRedisBackend(
  name: "upstash" | "vercel-kv",
  config: RedisConfig,
): Promise<RateLimiterBackend> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: config.url, token: config.token });

  return {
    name,
    check: async (opts) => {
      const now = Date.now();
      const count = Number(await redis.incr(opts.key));
      let ttl = Number(await redis.pttl(opts.key));
      if (count === 1 || ttl < 0) {
        await redis.pexpire(opts.key, opts.windowMs);
        ttl = opts.windowMs;
      }

      const remaining = Math.max(opts.limit - count, 0);
      const resetAt = now + (ttl > 0 ? ttl : opts.windowMs);
      return { ok: count <= opts.limit, remaining, resetAt };
    },
  };
}

async function createSupabaseBackend(): Promise<RateLimiterBackend | null> {
  if (!hasSupabaseConfig()) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    name: "supabase",
    check: async (opts) => {
      const { data, error } = await supabase.rpc("rate_limit_hit", {
        p_key: opts.key,
        p_window_ms: opts.windowMs,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const count = Number(row?.count ?? 0);
      const resetAt = row?.reset_at ? new Date(row.reset_at).getTime() : Date.now() + opts.windowMs;
      const remaining = Math.max(opts.limit - count, 0);
      return { ok: count <= opts.limit, remaining, resetAt };
    },
  };
}

async function resolveBackend(): Promise<RateLimiterBackend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      const upstashConfig = getUpstashConfig();
      if (upstashConfig) {
        const backend = await createRedisBackend("upstash", upstashConfig);
        backendName = backend.name;
        return backend;
      }

      const kvConfig = getVercelKvConfig();
      if (kvConfig) {
        const backend = await createRedisBackend("vercel-kv", kvConfig);
        backendName = backend.name;
        return backend;
      }

      if (shouldUseSupabaseFallback()) {
        const backend = await createSupabaseBackend();
        if (backend) {
          backendName = backend.name;
          return backend;
        }
      }

      backendName = memoryBackend.name;
      return memoryBackend;
    })();
  }

  return backendPromise;
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const backend = await resolveBackend();
  try {
    return await backend.check(opts);
  } catch (error) {
    if (!backendWarned) {
      console.warn(`[rateLimit] backend ${backend.name} failed, falling back to memory`, error);
      backendWarned = true;
    }
    return memoryBackend.check(opts);
  }
}

export async function getRateLimiterBackend(): Promise<RateLimiterBackendName> {
  if (backendName) return backendName;
  const backend = await resolveBackend();
  return backend.name;
}

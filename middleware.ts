// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQ = 20;       // 20 requests/min per IP+path

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Always discourage indexing at the edge
  res.headers.set("X-Robots-Tag", "noindex, nofollow");

  const { pathname } = req.nextUrl;

  // Rate-limit only API routes
  if (pathname.startsWith("/api")) {
    const ip =
      req.ip ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const key = `${ip}:${pathname}`;
    const now = Date.now();
    const b = buckets.get(key);

    if (!b || now > b.reset) {
      buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    } else {
      b.count++;
      if (b.count > MAX_REQ) {
        return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((b.reset - now) / 1000)),
            "X-RateLimit-Limit": String(MAX_REQ),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(b.reset / 1000)),
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      }
      buckets.set(key, b);
    }
  }

  return res;
}

// IMPORTANT: use a non-capturing group for extensions (?:png|jpg|...)
// Capturing groups `(...)` are not allowed in Next.js matcher patterns.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico)).*)',
  ],
};

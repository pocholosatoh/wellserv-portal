// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  // discourage indexing on every response
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

// No capturing groups in the matcher (uses a non-capturing group for extensions)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico)).*)',
  ],
};

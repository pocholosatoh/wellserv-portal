// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DOCTOR_PREFIX = "/doctor";
const DOCTOR_LOGIN_PATH = "/doctor/login";

// Any doctor-only API routes you want to allow without the cookie gate:
const DOCTOR_API_PREFIXES = ["/api/doctor/login", "/api/doctor/logout"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always set "noindex" header on responses
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");

  // --- Doctor gate (MVP cookie guard) -----------------------
  // Only guard /doctor* pages (not assets), and skip the login page itself,
  // and skip doctor auth APIs to avoid redirect loops.
  const isDoctorArea = pathname.startsWith(DOCTOR_PREFIX);
  const isDoctorLogin = pathname === DOCTOR_LOGIN_PATH;
  const isDoctorAuthApi = DOCTOR_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isDoctorArea && !isDoctorLogin && !isDoctorAuthApi) {
    const cookie = req.cookies.get("doctor_auth")?.value;

    if (!cookie) {
      // Not logged in → redirect to /doctor/login, preserve intended path
      const url = req.nextUrl.clone();
      url.pathname = DOCTOR_LOGIN_PATH;
      if (pathname !== "/doctor") {
        // pass the original path back as ?next=...
        const nextTarget = pathname + (search || "");
        url.searchParams.set("next", nextTarget);
      }
      return NextResponse.redirect(url);
    }
  }
  // ---------------------------------------------------------

  return res;
}

// Keep your original matcher that skips static assets & images.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico)).*)',
  ],
};

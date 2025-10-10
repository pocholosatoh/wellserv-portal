// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "doctor_session";

// If you prefer to only check the cookie's presence (no JWT verify), set this to false.
const VERIFY_JWT = true;

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Only guard /doctor/*, but allow the login page itself
  const isDoctorArea = pathname.startsWith("/doctor");
  const isLoginPage = pathname === "/doctor/login";

  if (!isDoctorArea || isLoginPage) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // Not logged in → send to login with next=<current path+query>
    const url = new URL("/doctor/login", req.url);
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  if (VERIFY_JWT) {
    const secretRaw = process.env.DOCTOR_SESSION_SECRET || "";
    if (!secretRaw) {
      // Fail open in dev to avoid loops if you forgot the env var; set to redirect if you prefer strict.
      console.warn("[middleware] DOCTOR_SESSION_SECRET missing; skipping JWT verify.");
      return NextResponse.next();
    }
    try {
      await jwtVerify(token, new TextEncoder().encode(secretRaw));
    } catch {
      // Invalid/expired token → force login
      const url = new URL("/doctor/login", req.url);
      url.searchParams.set("next", pathname + (search || ""));
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Guard every /doctor/* page; middleware does its own allowlist for /doctor/login
  matcher: ["/doctor/:path*"],
};

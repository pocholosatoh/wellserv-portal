import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, search } = url;

  /* ---------- STAFF GUARD ---------- */
  // Protect everything under /staff except the public login page.
  if (pathname.startsWith("/staff/") && !pathname.startsWith("/staff/login")) {
    // Legacy session (if you still use it)
    const legacySession = req.cookies.get("session")?.value;

    // New staff cookies (set via /api/auth/staff/login)
    const staffRole = req.cookies.get("staff_role")?.value || "";
    const staffInitials = req.cookies.get("staff_initials")?.value || "";
    // Optional extra gate:
    // const portalOK = req.cookies.get("staff_portal_ok")?.value === "1";

    const isLoggedIn = !!legacySession || (!!staffRole && !!staffInitials); // && portalOK

    if (!isLoggedIn) {
      const loginUrl = new URL("/staff/login", url);
      loginUrl.searchParams.set("next", pathname + (search || ""));
      return NextResponse.redirect(loginUrl);
    }
  }

  /* ---------- PATIENT GUARD ---------- */
  // Protect /patient and all nested routes.
  if (pathname.startsWith("/patient")) {
    const role = req.cookies.get("role")?.value || "";
    const isPatient = role === "patient";

    if (!isPatient) {
      const loginUrl = new URL("/login", url);
      loginUrl.searchParams.set("next", pathname + (search || ""));
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/staff/:path*",   // staff area
    "/patient/:path*", // patient area
  ],
};

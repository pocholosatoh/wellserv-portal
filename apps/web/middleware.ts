import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSignedCookie } from "@/lib/auth/signedCookiesEdge";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, search } = url;
  const isStaffPublic =
    pathname.startsWith("/staff/login") || pathname.startsWith("/staff/set-pin");

  /* ---------- STAFF GUARD ---------- */
  // Protect everything under /staff except the public login + first-time PIN pages.
  if (pathname.startsWith("/staff/") && !isStaffPublic) {
    // Legacy session (if you still use it)
    const legacySession = req.cookies.get("session")?.value;

    // New staff cookies (set via /api/auth/staff/login)
    const staffRole = (await readSignedCookie(req.cookies, "staff_role")) || "";
    const staffInitials = (await readSignedCookie(req.cookies, "staff_initials")) || "";
    const staffId = (await readSignedCookie(req.cookies, "staff_id")) || "";
    const staffCode = (await readSignedCookie(req.cookies, "staff_login_code")) || "";
    // Optional extra gate:
    // const portalOK = req.cookies.get("staff_portal_ok")?.value === "1";

    const isLoggedIn =
      !!legacySession || !!staffId || (!!staffRole && !!staffInitials) || !!staffCode; // && portalOK

    if (!isLoggedIn) {
      const loginUrl = new URL("/staff/login", url);
      loginUrl.searchParams.set("next", pathname + (search || ""));
      return NextResponse.redirect(loginUrl);
    }
  }

  /* ---------- PATIENT GUARD ---------- */
  // Protect /patient and all nested routes.
  if (pathname.startsWith("/patient")) {
    const role = (await readSignedCookie(req.cookies, "role")) || "";
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
    "/staff/:path*", // staff area
    "/patient/:path*", // patient area
  ],
};

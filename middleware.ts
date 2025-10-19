import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // Guard the staff area except the login page (adjust matchers as needed)
  const isStaffArea = pathname.startsWith("/staff/");
  const isLogin = pathname.startsWith("/staff/login");

  if (isStaffArea && !isLogin) {
    // 1) Your legacy session (if you have one)
    const legacySession = req.cookies.get("session")?.value;

    // 2) NEW: our staff cookies from the API route
    const role = req.cookies.get("staff_role")?.value;
    const initials = req.cookies.get("staff_initials")?.value;

    // Optional: if you want to enforce that the extra portal code passed once:
    const portalOK = req.cookies.get("staff_portal_ok")?.value;

    // Consider logged-in if legacy exists OR (role & initials exist).
    // If you want to enforce the portal flag too, add && portalOK === "1"
    const isLoggedIn = !!legacySession || (!!role && !!initials);

    if (!isLoggedIn) {
      const loginUrl = new URL("/staff/login", url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Keep your matcher (covers staff space). If you already have one, keep it.
export const config = {
  matcher: ["/staff/:path*"],
};

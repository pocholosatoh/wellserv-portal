import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = process.env.SESSION_COOKIE_NAME || "wellserv_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

const guards = [
  { match: (p: string) => p.startsWith("/doctor"),          roles: ["doctor"] as const,  login: "/doctor/login"  },
  { match: (p: string) => p === "/patient" || p.startsWith("/patient/"), roles: ["patient"] as const, login: "/login" },
  { match: (p: string) => p === "/results",                 roles: ["patient"] as const, login: "/login" },
  { match: (p: string) => p === "/prescriptions",           roles: ["patient"] as const, login: "/login" },
  { match: (p: string) => p.startsWith("/staff"),           roles: ["staff"] as const,   login: "/staff/login"   },
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const guard = guards.find(g => g.match(pathname));
  if (!guard) return NextResponse.next();

  // allow the role's login page itself
  if (pathname === guard.login) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    const url = new URL(guard.login, req.url);
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (!(guard.roles as readonly string[]).includes((payload.role as string))) {
      const url = new URL(guard.login, req.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  } catch {
    const url = new URL(guard.login, req.url);
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }
}

// Important: matcher must cover these standalone routes
export const config = {
  matcher: [
    "/doctor/:path*",
    "/patient",
    "/patient/:path*",
    "/results",
    "/prescriptions",
    "/staff/:path*",
  ],
};
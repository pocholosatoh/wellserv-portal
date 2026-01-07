// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/session";
import { clearSignedCookie } from "@/lib/auth/signedCookies";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

function pickDest(req: Request, explicit?: string | null, role?: string | null) {
  if (explicit) {
    if (explicit === "staff") return new URL("/staff/login", req.url);
    if (explicit === "doctor") return new URL("/doctor/login", req.url);
    if (explicit === "patient") return new URL("/login", req.url);
    return new URL("/login", req.url);
  }
  if (role === "staff") return new URL("/staff/login", req.url);
  if (role === "doctor") return new URL("/doctor/login", req.url);
  if (role === "patient") return new URL("/login", req.url);
  return new URL("/login", req.url);
}

async function handle(req: Request) {
  const ip = getRequestIp(req);
  const key = `public:auth-logout:${ip}`;
  const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const who = url.searchParams.get("who");

  // Peek at current session to choose a sensible target
  const session = await getSession().catch(() => null);
  const dest = pickDest(req, who, session?.role || null);

  // For POST logout, follow-up request should be GET, so use 303 instead of default 307.
  const status = req.method === "POST" ? 303 : 307;
  const res = NextResponse.redirect(dest, status);
  // wipe all the cookies the helper knows about (role, patient_id, staff_*)
  clearSession(res);

  // also clear the optional portal flag if present
  clearSignedCookie(res, "staff_portal_ok", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

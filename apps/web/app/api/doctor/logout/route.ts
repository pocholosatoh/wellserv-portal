export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { clearSignedCookie } from "@/lib/auth/signedCookies";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

const COOKIE_NAMES = [
  "doctor_id",
  "doctor_code",
  "doctor_name",
  "doctor_role",
  "doctor_credentials",
  "doctor_display_name",
  "doctor_prc_no",
  "doctor_branch",
  "doctor_philhealth_md_id",
];

function buildRedirectResponse(req: Request, to = "/doctor/login") {
  const url = new URL(to, req.url);
  const res = NextResponse.redirect(url, { status: 302 });

  // Expire all doctor cookies
  for (const name of COOKIE_NAMES) {
    clearSignedCookie(res, name, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return res;
}

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const key = `public:doctor-logout:${ip}`;
  const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  // If someone wants JSON (e.g., fetch), allow ?json=1
  const wantsJson = new URL(req.url).searchParams.get("json") === "1";
  if (wantsJson) {
    const res = NextResponse.json({ ok: true });
    for (const name of COOKIE_NAMES) {
      clearSignedCookie(res, name, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  }
  return buildRedirectResponse(req);
}

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const key = `public:doctor-logout:${ip}`;
  const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  return buildRedirectResponse(req);
}

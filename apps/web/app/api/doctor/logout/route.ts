export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

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
    res.cookies.set({
      name,
      value: "",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0, // delete
    });
  }

  return res;
}

export async function GET(req: Request) {
  // If someone wants JSON (e.g., fetch), allow ?json=1
  const wantsJson = new URL(req.url).searchParams.get("json") === "1";
  if (wantsJson) {
    const res = NextResponse.json({ ok: true });
    for (const name of COOKIE_NAMES) {
      res.cookies.set({
        name,
        value: "",
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      });
    }
    return res;
  }
  return buildRedirectResponse(req);
}

export async function POST(req: Request) {
  return buildRedirectResponse(req);
}

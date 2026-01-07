// app/api/doctor/branch/set/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { setSignedCookie } from "@/lib/auth/signedCookies";

const isProd = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor"] });
    if (!auth.ok) return auth.response;

    const { branch } = await req.json().catch(() => ({}));
    const b = String(branch || "").toUpperCase();
    if (b !== "SI" && b !== "SL") {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true, branch: b });
    setSignedCookie(res, "doctor_branch", b, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

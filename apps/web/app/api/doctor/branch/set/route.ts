// app/api/doctor/branch/set/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/doctorSession";

const isProd = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  try {
    const session = await getDoctorSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branch } = await req.json().catch(() => ({}));
    const b = String(branch || "").toUpperCase();
    if (b !== "SI" && b !== "SL") {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true, branch: b });
    res.cookies.set({
      name: "doctor_branch",
      value: b,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

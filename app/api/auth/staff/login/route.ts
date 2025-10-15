// app/api/auth/staff/login/route.ts
import { NextResponse } from "next/server";
import { setSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { code, tag, remember } = await req.json();

    const expected = (process.env.STAFF_PORTAL_ACCESS_CODE || "").trim();
    if (!expected) {
      return NextResponse.json({ error: "Server misconfigured (no STAFF_PORTAL_ACCESS_CODE)." }, { status: 500 });
    }
    if (String(code || "").trim() !== expected) {
      return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
    }

    const initials = String(tag || "").trim().toUpperCase().slice(0, 12);
    if (!initials) {
      return NextResponse.json({ error: "Enter your initials/name." }, { status: 400 });
    }

    // If your Session type supports `exp` (unix seconds), set it:
    const days = remember ? 14 : 1;
    const exp = Math.floor(Date.now() / 1000) + days * 86400;

    await setSession({
      role: "staff",
      sub: "staff",
      name: initials,
      //;exp,            // ✅ use absolute expiry, not expDays
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

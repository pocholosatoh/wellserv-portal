// app/api/doctor/reliever/login/route.ts
export const runtime = "nodejs";          // ← ensure Node runtime (cookies() works)
export const dynamic = "force-dynamic";   // ← no caching

import { NextResponse } from "next/server";
import { setDoctorSession } from "@/lib/doctorSession";
import crypto from "crypto";

function cleanName(raw: string) {
  return String(raw || "")
    .replace(/^\s*(dr\.?|doctor)\s+/i, "") // strip leading "Dr"/"Doctor"
    .replace(/\s+/g, " ")
    .trim();
}
function cleanCreds(raw: string) {
  return String(raw || "")
    .replace(/^,?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const { name, credentials, passcode } = await req.json();
    const expected = process.env.MD_RELIEVER_PASSCODE;

    if (!name || !passcode) {
      return NextResponse.json({ error: "Missing name or passcode" }, { status: 400 });
    }
    if (!expected || passcode !== expected) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    const fullName = cleanName(name);
    const creds    = cleanCreds(credentials);
    const display  = creds ? `${fullName}, ${creds}` : fullName;

    const reliefId = "relief_" + crypto.randomBytes(6).toString("hex");

    // Set the session cookie (doctorSession.ts uses secure=false in dev)
    await setDoctorSession({
      id: reliefId,
      code: "RELIEF",
      name: fullName,           // raw name without "Dr."
      role: "relief",
      credentials: creds,       // saved for UI/snapshot
      display_name: display,    // "Name, MD/FPCP"
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[reliever/login] error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

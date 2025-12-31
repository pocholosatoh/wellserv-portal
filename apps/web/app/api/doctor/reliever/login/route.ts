// app/api/doctor/reliever/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";

const isProd = process.env.NODE_ENV === "production";

function cleanName(raw: string) {
  return String(raw || "")
    .replace(/^\s*(dr\.?|doctor)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
function cleanCreds(raw: string) {
  return String(raw || "")
    .replace(/^,?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function setCookie(
  res: NextResponse,
  name: string,
  value: string,
  opts: Partial<{
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
    maxAge: number;
  }> = {},
) {
  res.cookies.set({
    name,
    value,
    httpOnly: opts.httpOnly ?? true,
    secure: opts.secure ?? isProd,
    sameSite: opts.sameSite ?? "lax",
    path: opts.path ?? "/",
    maxAge: opts.maxAge ?? 60 * 60 * 12, // 12 hours for relief logins
  });
}

export async function POST(req: Request) {
  try {
    const { name, credentials, passcode, branch, license_no, philhealth_md_id } = await req
      .json()
      .catch(() => ({}));

    const expected = process.env.MD_RELIEVER_PASSCODE;

    if (!name || !passcode) {
      return NextResponse.json({ error: "Missing name or passcode" }, { status: 400 });
    }
    if (!expected || passcode !== expected) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    // Identity
    const fullName = cleanName(name);
    const creds = cleanCreds(credentials);
    const display = creds ? `${fullName}, ${creds}` : fullName;
    const license = String(license_no || "").trim();

    // Ephemeral reliever id
    const reliefId = "relief_" + crypto.randomBytes(6).toString("hex");

    // Prepare response and set cookies (same shape as regular doctor cookies you already use)
    const res = NextResponse.json({ ok: true, reliefId });

    setCookie(res, "doctor_id", reliefId);
    setCookie(res, "doctor_code", "RELIEF");
    setCookie(res, "doctor_name", fullName);
    setCookie(res, "doctor_role", "relief");
    setCookie(res, "doctor_credentials", creds || "");
    setCookie(res, "doctor_display_name", display || "");
    if (license) setCookie(res, "doctor_prc_no", license);

    // Optional: PHIC id stored in cookie for claims/signing logic
    const phic = (philhealth_md_id || "").trim();
    if (phic) setCookie(res, "doctor_philhealth_md_id", phic);

    // Optional branch (defaults SL)
    const b = String(branch || "SL").toUpperCase();
    setCookie(res, "doctor_branch", b === "SI" ? "SI" : "SL");

    return res;
  } catch (e: any) {
    console.error("[reliever/login] error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

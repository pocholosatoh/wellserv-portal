// app/api/doctor/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

const isProd = process.env.NODE_ENV === "production";

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
  }> = {}
) {
  res.cookies.set({
    name,
    value,
    httpOnly: opts.httpOnly ?? true,
    secure: opts.secure ?? isProd,
    sameSite: opts.sameSite ?? "lax",
    path: opts.path ?? "/",
    maxAge: opts.maxAge ?? 60 * 60 * 24 * 30, // 30 days
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = String(body?.code ?? "").trim();
    const rawPin  = String(body?.pin  ?? "").trim();
    const branchOverride = String(body?.branch || "").trim().toUpperCase(); // optional "SI" | "SL" | "ALL"

    if (!rawCode || !rawPin) {
      return NextResponse.json({ error: "Missing code or pin" }, { status: 400 });
    }

    const code = rawCode.toUpperCase();
    const pin  = rawPin.replace(/\s+/g, "");

    const supabase = getSupabase();

    // Case-insensitive exact match (ILIKE without wildcards works as case-insensitive equality)
    const { data: doc, error } = await supabase
      .from("doctors")
      .select("doctor_id, code, display_name, full_name, credentials, pin_hash, active")
      .ilike("code", code)
      .maybeSingle();

    if (error || !doc) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (doc.active === false) {
      return NextResponse.json({ error: "Account inactive" }, { status: 403 });
    }

    const hash = String(doc.pin_hash || "");
    const ok = hash && (await bcrypt.compare(pin, hash));
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Build names
    const baseName = doc.display_name || doc.full_name || "";
    const creds    = doc.credentials || "";
    const display  = creds ? `${baseName}, ${creds}` : baseName;

    // Prepare response and set session cookies
    const res = NextResponse.json({ ok: true });

    setCookie(res, "doctor_id", String(doc.doctor_id));
    setCookie(res, "doctor_code", String(doc.code || ""));
    setCookie(res, "doctor_name", baseName || "");
    setCookie(res, "doctor_role", "regular"); // or "relief" based on your rules
    setCookie(res, "doctor_credentials", creds || "");
    setCookie(res, "doctor_display_name", display || "");

    // Branch cookie (optional but useful for queue scoping)
    // If you have a branch picker elsewhere, you can skip this.
    if (branchOverride === "SI" || branchOverride === "SL" || branchOverride === "ALL") {
      setCookie(res, "doctor_branch", branchOverride);
    } else {
      // If you already set staff_branch from the staff app and want to reuse it,
      // you can choose to leave doctor_branch unset here.
      // Otherwise default to SI:
      setCookie(res, "doctor_branch", "SI");
    }

    return res;
  } catch (e: any) {
    console.error("[/api/doctor/login] error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

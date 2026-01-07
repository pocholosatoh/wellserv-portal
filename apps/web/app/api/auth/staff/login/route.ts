// app/api/auth/staff/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { parseStaffLoginCode, staffRoleFromPrefix } from "@/lib/auth/staffCode";
import { verifyPin } from "@/lib/auth/pinHash";
import { setSession } from "@/lib/session";
import { setSignedCookie, clearSignedCookie } from "@/lib/auth/signedCookies";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

const isProd = process.env.NODE_ENV === "production";

function normalizeBranch(raw?: string) {
  const b = String(raw || "")
    .trim()
    .toUpperCase();
  if (b === "SL" || b === "ALL") return b;
  return "SI";
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
  if (opts.maxAge === 0) {
    clearSignedCookie(res, name, {
      httpOnly: opts.httpOnly ?? true,
      secure: opts.secure ?? isProd,
      sameSite: opts.sameSite ?? "lax",
      path: opts.path ?? "/",
    });
    return;
  }
  setSignedCookie(res, name, value, {
    httpOnly: opts.httpOnly ?? true,
    secure: opts.secure ?? isProd,
    sameSite: opts.sameSite ?? "lax",
    path: opts.path ?? "/",
    maxAge: opts.maxAge,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = String(body?.login_code ?? body?.code ?? "").trim();
    const rawPin = String(body?.pin ?? "").trim();
    const remember = !!body?.remember;
    const branch = normalizeBranch(body?.branch);

    const ip = getRequestIp(req);
    const key = `login:staff:${ip}:${rawCode || "unknown"}`;
    const limited = await checkRateLimit({ key, limit: 5, windowMs: 10 * 60 * 1000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    if (!rawCode || !rawPin) {
      return NextResponse.json({ error: "Login code and PIN are required." }, { status: 400 });
    }

    const { code, prefix, initials } = parseStaffLoginCode(rawCode);
    const supa = getSupabase();

    const { data: staff, error } = await supa
      .from("staff")
      .select("id, staff_no, login_code, pin_hash, active")
      .eq("active", true)
      .ilike("login_code", code)
      .maybeSingle();

    if (error || !staff) {
      return NextResponse.json(
        { error: "Invalid access code. Please check your login code or contact admin." },
        { status: 401 },
      );
    }

    if (!staff.pin_hash) {
      return NextResponse.json(
        { error: "Please set up your PIN first.", needsPinSetup: true },
        { status: 403 },
      );
    }

    const ok = await verifyPin(rawPin.replace(/\s+/g, ""), String(staff.pin_hash || ""));
    if (!ok) {
      return NextResponse.json({ error: "Invalid PIN. Please try again." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, staff_no: staff.staff_no, branch });

    setSession(res, {
      role: "staff",
      staff_id: staff.id,
      staff_no: String(staff.staff_no || ""),
      staff_login_code: staff.login_code || code,
      staff_role_prefix: prefix,
      staff_role: staffRoleFromPrefix(prefix),
      staff_branch: branch,
      staff_initials: initials,
      persist: remember,
    });

    if (prefix === "RMT") {
      setCookie(res, "section_assignment_reminder", "pending", {
        maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
      });
    } else {
      setCookie(res, "section_assignment_reminder", "", { maxAge: 0 });
    }

    // Maintain legacy portal_ok cookie for compatibility if needed.
    setCookie(res, "staff_portal_ok", "1", {
      maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Login failed" }, { status: 400 });
  }
}

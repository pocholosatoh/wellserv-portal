// app/api/auth/staff/login/route.ts
import { NextResponse } from "next/server";
import { parseStaffCode } from "@/lib/auth/parseStaffCode";
import { setSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, tag, remember, portalCode } = body || {};

    if (!code || !tag) {
      return NextResponse.json({ error: "Missing access code or initials." }, { status: 400 });
    }

    // Optional extra gate
    const REQUIRED = (process.env.STAFF_PORTAL_ACCESS_CODE || "").trim();
    if (REQUIRED && (typeof portalCode !== "string" || portalCode.trim() !== REQUIRED)) {
      return NextResponse.json({ error: "Invalid portal access code." }, { status: 401 });
    }

    // Parse "ROLE-BRANCH-INITIALS"
    const parsed = parseStaffCode(code, tag); // { role, branch_code, staff_initials }

    // Build response & set session cookies via helper
    const res = NextResponse.json({
      ok: true,
      role: parsed.role,
      branch_code: parsed.branch_code,
      initials: parsed.staff_initials,
    });

    setSession(res, {
      role: "staff",
      staff_role: parsed.role,          // 'admin' | 'reception' | 'rmt'
      staff_branch: parsed.branch_code, // 'SI' | 'SL' | 'ALL'
      staff_initials: parsed.staff_initials,
      persist: !!remember,
    });

    // optional flag that extra portal code check passed
    if (REQUIRED) {
      res.cookies.set("staff_portal_ok", "1", {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
      });
    }

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Login failed" }, { status: 400 });
  }
}

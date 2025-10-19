import { NextResponse } from "next/server";
import { parseStaffCode } from "@/lib/auth/parseStaffCode";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Expect: access code in Option A format (ROLE-BRANCH-INITIALS),
    // typed initials, remember flag, and the extra portal access code
    // from the login form.
    //
    // Frontend payload shape (example):
    // { code: "REC-SI-CHL", tag: "CHL", remember: true, portalCode: "XXXX-YYYY" }
    const { code, tag, remember, portalCode } = body || {};

    if (!code || !tag) {
      return NextResponse.json({ error: "Missing access code or initials." }, { status: 400 });
    }

    // EXTRA GATE: require STAFF_PORTAL_ACCESS_CODE (if set in env)
    const REQUIRED = (process.env.STAFF_PORTAL_ACCESS_CODE || "").trim();
    if (REQUIRED && (typeof portalCode !== "string" || portalCode.trim() !== REQUIRED)) {
      return NextResponse.json({ error: "Invalid portal access code." }, { status: 401 });
    }

    // Parse role-branch-initials (e.g., RMT-SI-CHL)
    const parsed = parseStaffCode(code, tag); // { role, branch_code, staff_initials }

    // Create response & set cookies used by the protected area
    const res = NextResponse.json({
      ok: true,
      role: parsed.role,
      branch_code: parsed.branch_code,
      initials: parsed.staff_initials,
    });

    const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12; // 30d or 12h

    res.cookies.set("staff_role", parsed.role, { path: "/", maxAge });
    res.cookies.set("staff_branch", parsed.branch_code, { path: "/", maxAge });
    res.cookies.set("staff_initials", parsed.staff_initials, { path: "/", maxAge });

    // Optional: a tiny flag to note that the extra portal code check passed
    if (REQUIRED) res.cookies.set("staff_portal_ok", "1", { path: "/", maxAge });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Login failed" }, { status: 400 });
  }
}

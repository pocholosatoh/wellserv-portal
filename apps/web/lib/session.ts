// lib/session.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { staffRoleFromPrefix } from "@/lib/auth/staffCode";

type SessionData = {
  // Who is logged in
  role: "patient" | "staff" | "doctor";
  // Patient session
  patient_id?: string;

  // Staff session (we already use these cookies elsewhere)
  staff_id?: string; // UUID from public.staff
  staff_no?: string; // auto-generated staff number (0001 etc.)
  staff_login_code?: string; // e.g., ADM-CHL
  staff_role_prefix?: string; // ADM | REC | RMT
  staff_role?: string; // 'admin' | 'reception' | 'rmt'
  staff_branch?: string; // 'SI' | 'SL' | 'ALL'
  staff_initials?: string; // 'CHL' etc.

  // Persist ~30 days if true, else session cookie
  persist?: boolean;
};

const isProd = process.env.NODE_ENV === "production";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function commonCookieOpts(persist?: boolean) {
  return {
    path: "/",
    httpOnly: false, // we intentionally read these on the client for UI
    sameSite: "lax" as const,
    secure: isProd,
    maxAge: persist ? THIRTY_DAYS : undefined,
  };
}

function normalizeCookieValue(value?: string | null) {
  if (!value) return "";
  return value.split(",")[0]?.trim() || "";
}

/**
 * Read a lightweight session snapshot from request cookies (server side).
 * Use this in server components / route handlers when you need to branch on role.
 */
export async function getSession() {
  const c = await cookies();
  const roleCookie = normalizeCookieValue(c.get("role")?.value);
  const staffRoleCookie = normalizeCookieValue(c.get("staff_role")?.value);
  const staffLoginCode = normalizeCookieValue(c.get("staff_login_code")?.value);
  const staffRolePrefixCookie = normalizeCookieValue(c.get("staff_role_prefix")?.value);
  const staffIdCookie = normalizeCookieValue(c.get("staff_id")?.value);

  const codePrefix =
    (staffLoginCode.includes("-") ? staffLoginCode.split("-")[0] : "").toUpperCase() || "";
  const staff_role_prefix = (staffRolePrefixCookie || codePrefix).toUpperCase();
  const derivedRole = staffRoleFromPrefix(staff_role_prefix);

  const hasStaffHints = !!(staffRoleCookie || staffLoginCode || staffIdCookie);
  const role = hasStaffHints ? "staff" : roleCookie;
  const staff_initials =
    normalizeCookieValue(c.get("staff_initials")?.value) ||
    (staffLoginCode.includes("-") ? staffLoginCode.split("-").slice(1).join("-") : "") ||
    "";

  const staff_role = (staffRoleCookie || "").toLowerCase() || derivedRole;

  return {
    role,
    patient_id: normalizeCookieValue(c.get("patient_id")?.value),
    staff_id: staffIdCookie || "",
    staff_no: normalizeCookieValue(c.get("staff_no")?.value),
    staff_login_code: staffLoginCode || "",
    staff_role_prefix,
    staff_role,
    staff_branch: normalizeCookieValue(c.get("staff_branch")?.value),
    staff_initials,
  };
}

/**
 * Set session cookies on a NextResponse (API route handler).
 * Usage:
 *   const res = NextResponse.json({ ok: true });
 *   setSession(res, { role: "patient", patient_id: pid, persist: true });
 *   return res;
 */
export function setSession(res: NextResponse, data: SessionData) {
  const opts = commonCookieOpts(data.persist);

  // Always set a generic "role" cookie for quick checks
  if (data.role) res.cookies.set("role", data.role, opts);

  // Patient session
  if (data.patient_id) res.cookies.set("patient_id", data.patient_id, opts);

  // Staff session (used across staff UIs)
  if (data.staff_id) res.cookies.set("staff_id", data.staff_id, opts);
  if (data.staff_no) res.cookies.set("staff_no", data.staff_no, opts);
  if (data.staff_login_code) res.cookies.set("staff_login_code", data.staff_login_code, opts);
  if (data.staff_role_prefix) res.cookies.set("staff_role_prefix", data.staff_role_prefix, opts);
  if (data.staff_role) res.cookies.set("staff_role", data.staff_role, opts);
  if (data.staff_branch) res.cookies.set("staff_branch", data.staff_branch, opts);
  if (data.staff_initials) res.cookies.set("staff_initials", data.staff_initials, opts);

  return res;
}

/**
 * Clear all known session cookies on a NextResponse.
 * Usage:
 *   const res = NextResponse.redirect(new URL("/staff/login", req.url));
 *   clearSession(res);
 *   return res;
 */
export function clearSession(res: NextResponse) {
  const base = { path: "/", httpOnly: false, sameSite: "lax" as const, secure: isProd, maxAge: 0 };

  [
    "role",
    "patient_id",
    "staff_id",
    "staff_no",
    "staff_login_code",
    "staff_role_prefix",
    "staff_role",
    "staff_branch",
    "staff_initials",
    "section_assignment_reminder",
  ].forEach((k) => {
    res.cookies.set(k, "", base);
  });

  return res;
}

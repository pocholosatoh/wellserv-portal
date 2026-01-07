// lib/session.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { staffRoleFromPrefix } from "@/lib/auth/staffCode";
import { readSignedCookie, setSignedCookie, clearSignedCookie } from "@/lib/auth/signedCookies";

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
    httpOnly: true,
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
  const roleCookie = normalizeCookieValue(readSignedCookie(c, "role"));
  const staffRoleCookie = normalizeCookieValue(readSignedCookie(c, "staff_role"));
  const staffLoginCode = normalizeCookieValue(readSignedCookie(c, "staff_login_code"));
  const staffRolePrefixCookie = normalizeCookieValue(readSignedCookie(c, "staff_role_prefix"));
  const staffIdCookie = normalizeCookieValue(readSignedCookie(c, "staff_id"));

  const codePrefix =
    (staffLoginCode.includes("-") ? staffLoginCode.split("-")[0] : "").toUpperCase() || "";
  const staff_role_prefix = (staffRolePrefixCookie || codePrefix).toUpperCase();
  const derivedRole = staffRoleFromPrefix(staff_role_prefix);

  const hasStaffHints = !!(staffRoleCookie || staffLoginCode || staffIdCookie);
  const role = hasStaffHints ? "staff" : roleCookie;
  const staff_initials =
    normalizeCookieValue(readSignedCookie(c, "staff_initials")) ||
    (staffLoginCode.includes("-") ? staffLoginCode.split("-").slice(1).join("-") : "") ||
    "";

  const staff_role = (staffRoleCookie || "").toLowerCase() || derivedRole;

  return {
    role,
    patient_id: normalizeCookieValue(readSignedCookie(c, "patient_id")),
    staff_id: staffIdCookie || "",
    staff_no: normalizeCookieValue(readSignedCookie(c, "staff_no")),
    staff_login_code: staffLoginCode || "",
    staff_role_prefix,
    staff_role,
    staff_branch: normalizeCookieValue(readSignedCookie(c, "staff_branch")),
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
  if (data.role) setSignedCookie(res, "role", data.role, opts);

  // Patient session
  if (data.patient_id) setSignedCookie(res, "patient_id", data.patient_id, opts);

  // Staff session (used across staff UIs)
  if (data.staff_id) setSignedCookie(res, "staff_id", data.staff_id, opts);
  if (data.staff_no) setSignedCookie(res, "staff_no", data.staff_no, opts);
  if (data.staff_login_code) setSignedCookie(res, "staff_login_code", data.staff_login_code, opts);
  if (data.staff_role_prefix)
    setSignedCookie(res, "staff_role_prefix", data.staff_role_prefix, opts);
  if (data.staff_role) setSignedCookie(res, "staff_role", data.staff_role, opts);
  if (data.staff_branch) setSignedCookie(res, "staff_branch", data.staff_branch, opts);
  if (data.staff_initials) setSignedCookie(res, "staff_initials", data.staff_initials, opts);

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
  const base = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: isProd, maxAge: 0 };

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
    clearSignedCookie(res, k, base);
  });

  return res;
}

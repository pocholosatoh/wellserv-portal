// lib/session.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type SessionData = {
  // Who is logged in
  role: "patient" | "staff" | "doctor";
  // Patient session
  patient_id?: string;

  // Staff session (we already use these cookies elsewhere)
  staff_role?: string;     // 'admin' | 'reception' | 'rmt'
  staff_branch?: string;   // 'SI' | 'SL' | 'ALL'
  staff_initials?: string; // 'CHL' etc.

  // Persist ~30 days if true, else session cookie
  persist?: boolean;
};

const isProd = process.env.NODE_ENV === "production";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function commonCookieOpts(persist?: boolean) {
  return {
    path: "/",
    httpOnly: false,           // we intentionally read these on the client for UI
    sameSite: "lax" as const,
    secure: isProd,
    maxAge: persist ? THIRTY_DAYS : undefined,
  };
}

/**
 * Read a lightweight session snapshot from request cookies (server side).
 * Use this in server components / route handlers when you need to branch on role.
 */
export async function getSession() {
  const c = await cookies();
  const role = c.get("role")?.value || c.get("staff_role")?.value ? "staff" : (c.get("role")?.value || "");
  return {
    role: c.get("role")?.value || "",
    patient_id: c.get("patient_id")?.value || "",
    staff_role: c.get("staff_role")?.value || "",
    staff_branch: c.get("staff_branch")?.value || "",
    staff_initials: c.get("staff_initials")?.value || "",
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
  if (data.staff_role)     res.cookies.set("staff_role", data.staff_role, opts);
  if (data.staff_branch)   res.cookies.set("staff_branch", data.staff_branch, opts);
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

  ["role", "patient_id", "staff_role", "staff_branch", "staff_initials"].forEach((k) => {
    res.cookies.set(k, "", base);
  });

  return res;
}

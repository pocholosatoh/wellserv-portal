import { NextResponse } from "next/server";
import { getSession } from "@/lib/session"; // keep this; we no longer import clearSession

// Clear all auth-related cookies we use
function clearAllAuthCookies(res: NextResponse) {
  const names = [
    // our staff cookies
    "staff_role",
    "staff_branch",
    "staff_initials",
    "staff_portal_ok",
    // legacy app session (if you still have it)
    "session",
  ];
  for (const n of names) {
    res.cookies.set(n, "", { path: "/", maxAge: 0 });
  }
}

// Decide destination
function pickDest(req: Request, explicit?: string | null, sessionRole?: string | null) {
  // 1) explicit query param wins (?who=staff|doctor|patient)
  if (explicit) {
    if (explicit === "staff")   return new URL("/staff/login",   req.url);
    if (explicit === "doctor")  return new URL("/doctor/login",  req.url);
    if (explicit === "patient") return new URL("/login",         req.url);
    return new URL("/login", req.url);
  }

  // 2) fall back to session role (if any)
  if (sessionRole === "staff")    return new URL("/staff/login",  req.url);
  if (sessionRole === "doctor")   return new URL("/doctor/login", req.url);
  if (sessionRole === "patient")  return new URL("/login",        req.url);

  // 3) default
  return new URL("/login", req.url);
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const who = url.searchParams.get("who");

  // Peek session FIRST so we can choose the right destination
  // Your getSession returns { role: "staff" } when staff cookies exist.
  const session = await getSession().catch(() => null);
  const sessionRole = session?.role ?? null;

  // Build redirect response to chosen destination…
  const dest = pickDest(req, who, sessionRole);
  const res = NextResponse.redirect(dest);

  // …and clear cookies on that same response
  clearAllAuthCookies(res);

  return res;
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }

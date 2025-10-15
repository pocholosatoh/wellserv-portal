import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/session";

function pickDest(req: Request, explicit?: string | null) {
  // 1) explicit query param ?who=...
  if (explicit) {
    if (explicit === "staff")  return new URL("/staff/login",  req.url);
    if (explicit === "doctor") return new URL("/doctor/login", req.url);
    return new URL("/login", req.url); // "patient" or anything else
  }

  // 2) try current session role (if still present)
  //    note: we'll call getSession() before clear to use this.
  return null;
}

async function handle(req: Request) {
  // Look at query override
  const url = new URL(req.url);
  const who = url.searchParams.get("who");

  // Peek at session (so we can choose a role-specific target), then clear it
  const session = await getSession();

  await clearSession();

  // Compute redirect target
  let dest = pickDest(req, who);
  if (!dest) {
    if (session?.role === "staff")    dest = new URL("/staff/login",  req.url);
    else if (session?.role === "doctor") dest = new URL("/doctor/login", req.url);
    else dest = new URL("/login", req.url);
  }

  return NextResponse.redirect(dest);
}

export async function POST(req: Request) { return handle(req); }
export async function GET(req: Request)  { return handle(req); }

import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { setSignedCookie } from "@/lib/auth/signedCookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBranch(raw?: string) {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  return v === "SI" || v === "SL" ? v : "";
}

export async function POST(req: Request) {
  const auth = await guard(req, { allow: ["staff"], requireBranch: false });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const next = normalizeBranch(body?.branch || body?.branch_code);
  if (!next) {
    return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, branch: next });
  setSignedCookie(res, "staff_branch", next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

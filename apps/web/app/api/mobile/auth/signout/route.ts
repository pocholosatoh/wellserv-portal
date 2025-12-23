import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearSession(res);
  return res;
}

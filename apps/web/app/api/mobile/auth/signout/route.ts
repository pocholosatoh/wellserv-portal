import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const key = `public:mobile-signout:${ip}`;
  const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearSession(res);
  return res;
}

// app/api/consultations/finish/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const key = `public:consultations-finish:${ip}`;
  const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  // Hard deprecate this path to avoid a third “finish” route.
  return NextResponse.json(
    {
      error:
        "Deprecated endpoint. Use /api/prescriptions/sign (finish WITH Rx) or /api/doctor/consultations/finalize (finish WITHOUT Rx).",
    },
    { status: 410 },
  );
}

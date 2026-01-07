// app/api/config/route.ts
import { NextResponse } from "next/server";
import { sbReadConfig } from "@/lib/supabase"; // <-- Supabase only
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = getRequestIp(req);
    const key = `public:config:${ip}`;
    const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const config = await sbReadConfig();
    return NextResponse.json({ config });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

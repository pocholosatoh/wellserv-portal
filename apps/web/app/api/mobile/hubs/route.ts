import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = getRequestIp(req);
    const key = `public:mobile-hubs:${ip}`;
    const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const supa = getSupabase();
    const { data, error } = await supa
      .from("hubs")
      .select("code, name, address, contact")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unable to load hubs" }, { status: 500 });
  }
}

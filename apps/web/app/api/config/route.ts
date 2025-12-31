// app/api/config/route.ts
import { NextResponse } from "next/server";
import { sbReadConfig } from "@/lib/supabase"; // <-- Supabase only
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await sbReadConfig();
    return NextResponse.json({ config });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

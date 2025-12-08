import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supa = getSupabase();
    const { data, error } = await supa
      .from("hubs")
      .select("code, name, address, contact")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unable to load hubs" },
      { status: 500 }
    );
  }
}

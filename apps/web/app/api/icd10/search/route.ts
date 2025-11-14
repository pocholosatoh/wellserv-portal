export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor } from "@/lib/api-actor";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(); // doctor/staff/patient
    if (!actor || actor.kind === "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ items: [] });

    const db = getSupabase();

    // Prefer code exact starts-with; then title ILIKE; small page
    const { data, error } = await db
      .from("icd10")
      .select("code, title")
      .or(`code.ilike.${q.replace(/%/g, "")}%,title.ilike.%${q}%`)
      .order("code", { ascending: true })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

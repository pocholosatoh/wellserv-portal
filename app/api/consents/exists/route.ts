import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const encId = (searchParams.get("encounter_id") || "").trim();
  if (!encId) return NextResponse.json({ error: "encounter_id required" }, { status: 400 });

  const db = getSupabase();
  const { count, error } = await db
    .from("patient_consents")
    .select("id", { count: "exact", head: true })
    .eq("encounter_id", encId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exists: (count || 0) > 0 });
}

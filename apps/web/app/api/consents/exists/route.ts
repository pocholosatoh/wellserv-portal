import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
  if (!auth.ok) return auth.response;

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

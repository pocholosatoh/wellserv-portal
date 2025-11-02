import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supa = getSupabaseServer();
  const { data, error } = await supa
    .from("ecg_cases")
    .select("id, patient_id, encounter_id, uploaded_at, status, external_result_id")
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

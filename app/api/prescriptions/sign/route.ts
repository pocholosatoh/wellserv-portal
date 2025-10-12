// app/api/prescriptions/sign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const { prescriptionId } = await req.json();

  if (!prescriptionId) {
    return NextResponse.json({ error: "prescriptionId required" }, { status: 400 });
  }

  // fetch the draft and its consultation
  const { data: draft, error: fErr } = await supabase
    .from("prescriptions")
    .select("id, consultation_id")
    .eq("id", prescriptionId)
    .maybeSingle();

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
  if (!draft) return NextResponse.json({ error: "Prescription not found." }, { status: 404 });

  // deactivate any other signed Rx for the same consultation
  const { error: clearErr } = await supabase
    .from("prescriptions")
    .update({ active: false, is_superseded: true })
    .eq("consultation_id", draft.consultation_id)
    .eq("status", "signed");

  if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 });

  // sign this one
  const { error: signErr } = await supabase
    .from("prescriptions")
    .update({ status: "signed", active: true, updated_at: new Date().toISOString() })
    .eq("id", prescriptionId);

  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 });

  return NextResponse.json({ id: prescriptionId, status: "signed" });
}

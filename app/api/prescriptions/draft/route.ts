// app/api/prescriptions/draft/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase"; // your server client

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const consultationId = searchParams.get("consultation_id");

  if (!consultationId) {
    return NextResponse.json({ error: "consultation_id required" }, { status: 400 });
  }

  // Return the draft when available; otherwise send an empty payload (RxPanel will decide what to show).
  const { data: draft, error } = await supabase
    .from("prescriptions")
    .select("id, notes_for_patient, status, valid_days")
    .eq("consultation_id", consultationId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!draft) {
    return NextResponse.json({ id: null, items: [], notes_for_patient: null, valid_days: null }, { status: 200 });
  }

  const { data: items, error: itemsErr } = await supabase
    .from("prescription_items")
    .select("med_id, generic_name, strength, form, brand_name, route, dose_amount, dose_unit, frequency_code, duration_days, quantity, instructions, unit_price")
    .eq("prescription_id", draft.id)
    .order("created_at", { ascending: true });

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  return NextResponse.json({
    id: draft.id,
    notes_for_patient: draft.notes_for_patient,
    valid_days: draft.valid_days,
    items: items || [],
  });
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase();
  const body = await req.json().catch(() => ({}));
  const consultationId = body?.consultationId || body?.consultation_id;

  if (!consultationId) {
    return NextResponse.json({ error: "consultationId required" }, { status: 400 });
  }

  // delete only draft for this consultation
  const { data: draft, error } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("consultation_id", consultationId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!draft) return NextResponse.json({ ok: true }); // nothing to delete

  const { error: delItemsErr } = await supabase
    .from("prescription_items")
    .delete()
    .eq("prescription_id", draft.id);
  if (delItemsErr) return NextResponse.json({ error: delItemsErr.message }, { status: 500 });

  const { error: delRxErr } = await supabase.from("prescriptions").delete().eq("id", draft.id);
  if (delRxErr) return NextResponse.json({ error: delRxErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

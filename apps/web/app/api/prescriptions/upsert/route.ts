// app/api/prescriptions/upsert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_RX_VALID_DAYS, normalizeValidDays } from "@/lib/rx";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const { consultationId, patientId, notesForPatient, items, validDays } = await req.json();

  if (!consultationId || !patientId) {
    return NextResponse.json(
      { error: "consultationId and patientId are required" },
      { status: 400 },
    );
  }

  const finalValidDays = normalizeValidDays(validDays, DEFAULT_RX_VALID_DAYS);

  // find or create draft
  const { data: existing, error: findErr } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("consultation_id", consultationId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });

  let draftId = existing?.id as string | undefined;

  if (!draftId) {
    const { data, error: insErr } = await supabase
      .from("prescriptions")
      .insert({
        consultation_id: consultationId,
        patient_id: patientId,
        status: "draft",
        notes_for_patient: notesForPatient ?? "",
        active: false,
        is_superseded: false,
        valid_days: finalValidDays,
      })
      .select("id")
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    draftId = data!.id;
  } else {
    const { error: updErr } = await supabase
      .from("prescriptions")
      .update({ notes_for_patient: notesForPatient ?? "", valid_days: finalValidDays })
      .eq("id", draftId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // replace items
  const { error: delErr } = await supabase
    .from("prescription_items")
    .delete()
    .eq("prescription_id", draftId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (Array.isArray(items) && items.length) {
    const rows = items.map((it: any) => ({
      prescription_id: draftId,
      med_id: it.med_id ?? null,
      generic_name: it.generic_name ?? null,
      strength: it.strength ?? null,
      form: it.form ?? null,
      brand_name: it.brand_name ?? null,
      route: it.route ?? null,
      dose_amount: it.dose_amount ?? null,
      dose_unit: it.dose_unit ?? null,
      frequency_code: it.frequency_code ?? null,
      duration_days: it.duration_days ?? null,
      quantity: it.quantity ?? null,
      instructions: it.instructions ?? null,
      unit_price: it.unit_price ?? null,
    }));

    const { error: insItemsErr } = await supabase.from("prescription_items").insert(rows);
    if (insItemsErr) return NextResponse.json({ error: insItemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: draftId });
}

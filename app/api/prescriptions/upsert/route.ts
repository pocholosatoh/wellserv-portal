// app/api/prescriptions/upsert/route.ts
// Upserts a prescription header + items in one call.
// Expect body:
// {
//   consultationId, patientId,
//   showPrices, notesForPatient,
//   wantPharmacyOrder, deliveryAddress,
//   items: [{ ..., unit_price }]   // unit_price optional but recommended
// }

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      consultationId,
      patientId,
      showPrices,
      notesForPatient,
      wantPharmacyOrder,
      deliveryAddress,
      items = [],
    } = body || {};

    if (!consultationId || !patientId) {
      return NextResponse.json(
        { error: "Missing consultationId or patientId" },
        { status: 400 }
      );
    }

    // MVP doctor auth
    const cookie = (await cookies()).get("doctor_auth")?.value;
    if (!cookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const doc = JSON.parse(cookie);
    const doctorId = (doc?.doctor_id as string) || null;

    // 1) Find existing DRAFT for this consultation (only one at a time)
    const { data: existing, error: qErr } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("consultation_id", consultationId)
      .eq("status", "draft")
      .limit(1)
      .maybeSingle();
    if (qErr) {
      console.error("[rx upsert] query error:", qErr);
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    // 2) Upsert header
    let rxId: string;
    if (existing) {
      const { data, error } = await supabase
        .from("prescriptions")
        .update({
          patient_id: patientId,
          doctor_id: doctorId ?? existing.doctor_id,
          show_prices: !!showPrices,
          notes_for_patient: notesForPatient ?? null,

          // NEW fields for MVP Phase 6
          want_pharmacy_order: !!wantPharmacyOrder,
          order_requested_at:
            wantPharmacyOrder && !existing.order_requested_at
              ? new Date().toISOString()
              : existing.order_requested_at,
          delivery_address:
            typeof deliveryAddress === "string" && deliveryAddress.trim()
              ? deliveryAddress.trim()
              : existing.delivery_address ?? null,
        })
        .eq("id", existing.id)
        .select("id")
        .single();

      if (error) {
        console.error("[rx upsert] update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rxId = data.id;
    } else {
      const { data, error } = await supabase
        .from("prescriptions")
        .insert({
          consultation_id: consultationId,
          patient_id: patientId,
          doctor_id: doctorId,
          status: "draft",
          show_prices: !!showPrices,
          notes_for_patient: notesForPatient ?? null,

          // NEW fields for MVP Phase 6
          want_pharmacy_order: !!wantPharmacyOrder,
          order_requested_at: wantPharmacyOrder ? new Date().toISOString() : null,
          delivery_address:
            typeof deliveryAddress === "string" && deliveryAddress.trim()
              ? deliveryAddress.trim()
              : null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[rx upsert] insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rxId = data.id;
    }

    // 3) Replace items for this draft
    const { error: delErr } = await supabase
      .from("prescription_items")
      .delete()
      .eq("prescription_id", rxId);
    if (delErr) {
      console.error("[rx upsert] delete items error:", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    if (Array.isArray(items) && items.length > 0) {
      const rows = items.map((it: any) => ({
        prescription_id: rxId,
        med_id: it.med_id ?? null,
        generic_name: it.generic_name ?? null,
        strength: it.strength ?? null,
        form: it.form ?? null,
        route: it.route ?? null,
        dose_amount: it.dose_amount ?? null,
        dose_unit: it.dose_unit ?? null,
        frequency_code: it.frequency_code ?? null,
        duration_days: it.duration_days ?? null,
        quantity: it.quantity ?? null,
        instructions: it.instructions ?? null,

        // NEW: persist price used at prescribe time
        unit_price:
          typeof it.unit_price === "number" ? it.unit_price : it.unit_price != null ? Number(it.unit_price) : null,
      }));

      const { error: insErr } = await supabase
        .from("prescription_items")
        .insert(rows);

      if (insErr) {
        console.error("[rx upsert] insert items error:", insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, prescription_id: rxId });
  } catch (e: any) {
    console.error("[rx upsert] unexpected:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// app/api/prescriptions/revise/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_RX_VALID_DAYS } from "@/lib/rx";

export async function POST(req: NextRequest) {
  try {
    const { consultationId } = await req.json();
    if (!consultationId) {
      return NextResponse.json({ error: "consultationId required" }, { status: 400 });
    }

    const db = getSupabase();

    // 1) Find the active signed Rx for this consultation
    const active = await db
      .from("prescriptions")
      .select("id, patient_id, doctor_id, notes_for_patient, valid_days")
      .eq("consultation_id", consultationId)
      .eq("status", "signed")
      .eq("active", true)
      .maybeSingle();

    if (active.error) {
      return NextResponse.json({ error: active.error.message }, { status: 500 });
    }
    if (!active.data) {
      return NextResponse.json({ error: "No active signed prescription to revise." }, { status: 409 });
    }

    // BEFORE step 2) insert draft, clean up any existing drafts for this consultation
    // (delete items first to avoid FK issues, then delete the draft rx rows)
    const drafts = await db
      .from("prescriptions")
      .select("id")
      .eq("consultation_id", consultationId)
      .eq("status", "draft");

    if (drafts.error) {
      return NextResponse.json({ error: drafts.error.message }, { status: 500 });
    }

    const draftIds = (drafts.data || []).map((r: { id: string }) => r.id);

    if (draftIds.length) {
      const delItems = await db
        .from("prescription_items")
        .delete()
        .in("prescription_id", draftIds);

      if (delItems.error) {
        return NextResponse.json({ error: delItems.error.message }, { status: 500 });
      }

      const delDrafts = await db
        .from("prescriptions")
        .delete()
        .in("id", draftIds);

      if (delDrafts.error) {
        return NextResponse.json({ error: delDrafts.error.message }, { status: 500 });
      }
    }


    // 2) Create a new DRAFT that supersedes the active
    const ins = await db
      .from("prescriptions")
      .insert({
        consultation_id: consultationId,
        patient_id: active.data.patient_id,
        doctor_id: active.data.doctor_id,         // keep same doctor snapshot
        status: "draft",
        notes_for_patient: active.data.notes_for_patient ?? "",
        valid_days: active.data.valid_days ?? DEFAULT_RX_VALID_DAYS,
        active: false,
        is_superseded: false,
        supersedes_prescription_id: active.data.id,
      })
      .select("id")
      .single();

    if (ins.error) {
      return NextResponse.json({ error: ins.error.message }, { status: 500 });
    }

    const newDraftId = ins.data.id as string;

    // 3) Copy items from active → draft, generating NEW ids
    const itemsQ = await db
      .from("prescription_items")
      .select(
        "med_id, generic_name, brand_name, strength, form, route, dose_amount, dose_unit, frequency_code, duration_days, quantity, instructions, unit_price"
      )
      .eq("prescription_id", active.data.id);

    if (itemsQ.error) {
      return NextResponse.json({ error: itemsQ.error.message }, { status: 500 });
    }

    let cloned: any[] = [];
    if (itemsQ.data && itemsQ.data.length) {
      const { randomUUID } = await import("crypto");
      const now = new Date().toISOString();

      cloned = itemsQ.data.map((it) => ({
        id: randomUUID(),               // ✅ NEW UUID per cloned line (fixes NOT NULL / unique)
        prescription_id: newDraftId,
        med_id: it.med_id ?? null,
        generic_name: it.generic_name ?? null,
        brand_name: it.brand_name ?? null,
        strength: it.strength ?? null,
        form: it.form ?? null,
        route: it.route ?? null,
        dose_amount: it.dose_amount ?? null,
        dose_unit: it.dose_unit ?? null,
        frequency_code: it.frequency_code ?? null,
        duration_days: it.duration_days ?? null,
        quantity: it.quantity ?? null,
        instructions: it.instructions ?? null,
        unit_price: it.unit_price ?? null,
        created_at: now,
        updated_at: now,
      }));

      const insItems = await db.from("prescription_items").insert(cloned);
      if (insItems.error) {
        return NextResponse.json({ error: insItems.error.message }, { status: 500 });
      }
    }

    // 4) Return the new draft + items so the panel can hydrate immediately
    return NextResponse.json({
      id: newDraftId,
      consultation_id: consultationId,
      patient_id: active.data.patient_id,
      doctor_id: active.data.doctor_id,
      notes_for_patient: active.data.notes_for_patient ?? "",
      valid_days: active.data.valid_days ?? DEFAULT_RX_VALID_DAYS,
      items: (cloned || []).map((r) => ({
        med_id: r.med_id,
        generic_name: r.generic_name,
        brand_name: r.brand_name,
        strength: r.strength,
        form: r.form,
        route: r.route,
        dose_amount: r.dose_amount,
        dose_unit: r.dose_unit,
        frequency_code: r.frequency_code,
        duration_days: r.duration_days,
        quantity: r.quantity,
        instructions: r.instructions,
        unit_price: r.unit_price,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

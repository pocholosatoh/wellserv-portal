// app/api/patient/prescriptions/route.ts
// Returns all SIGNED prescriptions for a patient (newest first).
// Supports patient portal (session) and doctor/staff (provide patient_id).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor, getTargetPatientId } from "@/lib/api-actor";

export async function GET(req: Request) {
  try {
    const supabase = getSupabase();

    // Accept patient portal, doctor, or staff
    const actor = await requireActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve patient_id:
    // - patient portal: from session
    // - doctor/staff:   from query ?patient_id= or ?pid=
    const { searchParams } = new URL(req.url);
    const patient_id = getTargetPatientId(actor, { searchParams });

    if (!patient_id) {
      return NextResponse.json(
        { error: "patient_id required" },
        { status: 400 }
      );
    }

    // 1) Fetch SIGNED prescriptions (newest first)
    const { data: rxList, error: rxErr } = await supabase
      .from("prescriptions")
      .select(
        `
        id,
        patient_id,
        doctor_id,
        status,
        show_prices,
        notes_for_patient,
        discount_type,
        discount_value,
        discount_expires_at,
        discount_applied_by,
        final_total,
        want_pharmacy_order,
        order_requested_at,
        delivery_address,
        supersedes_prescription_id,
        is_superseded,
        active,
        created_at,
        updated_at
        `
      )
      .eq("patient_id", patient_id)
      .eq("status", "signed")
      .order("created_at", { ascending: false });

    if (rxErr) {
      return NextResponse.json({ error: rxErr.message }, { status: 500 });
    }

    if (!rxList?.length) {
      return NextResponse.json({ prescriptions: [] });
    }

    // 2) Fetch items for these prescriptions in one query
    const ids = rxList.map((r) => r.id);
    const { data: items, error: itErr } = await supabase
      .from("prescription_items")
      .select(
        `
        id,
        prescription_id,
        med_id,
        generic_name,
        brand_name,
        strength,
        form,
        route,
        dose_amount,
        dose_unit,
        frequency_code,
        duration_days,
        quantity,
        instructions,
        unit_price,
        created_at,
        updated_at
        `
      )
      .in("prescription_id", ids)
      .order("created_at", { ascending: true });

    if (itErr) {
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    // 3) Group items by prescription_id and attach
    const byRx = new Map<string, any[]>();
    for (const it of items || []) {
      const arr = byRx.get(it.prescription_id) || [];
      arr.push(it);
      byRx.set(it.prescription_id, arr);
    }

    const out = rxList.map((r) => ({
      ...r,
      items: byRx.get(r.id) || [],
    }));

    return NextResponse.json({ prescriptions: out });
  } catch (e: any) {
    console.error("[patient/prescriptions] unexpected:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

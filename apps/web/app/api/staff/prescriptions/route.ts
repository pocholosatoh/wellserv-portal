// app/api/staff/prescriptions/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const patientRaw = url.searchParams.get("patient_id") || "";
    const patientId = patientRaw.trim().toUpperCase();

    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const db = getSupabase();

    // If you have a FK from prescription_items.prescription_id -> prescriptions.id,
    // Postgrest can embed with "items:prescription_items(*)".
    const { data, error } = await db
      .from("prescriptions")
      .select(
        `
        id,
        consultation_id,
        patient_id,
        doctor_id,
        status,
        notes_for_patient,
        show_prices,
        discount_type,
        discount_value,
        discount_expires_at,
        discount_applied_by,
        final_total,
        valid_days,
        valid_until,
        created_at,
        updated_at,
        want_pharmacy_order,
        order_requested_at,
        delivery_address,
        items:prescription_items!prescription_items_prescription_id_fkey(
          id,
          prescription_id,
          med_id,
          generic_name,
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
        )
      `,
      )
      .eq("patient_id", patientId)
      .eq("status", "signed")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ prescriptions: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

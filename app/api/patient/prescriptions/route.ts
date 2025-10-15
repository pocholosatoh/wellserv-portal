// app/api/patient/prescriptions/route.ts
// Return all SIGNED prescriptions for the logged-in patient (newest first).
// For local dev, also accepts ?patient_id=<id> if no session is present.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const supabase = getSupabase();

    // 1) Resolve patient_id:
    //    Prefer httpOnly session (production); allow ?patient_id= for local dev if no session.
    const session = await getSession();
    const sessionPid =
      session && session.role === "patient" ? String(session.sub).trim() : "";

    const queryPid = (url.searchParams.get("patient_id") || "").trim();
    const patientId = sessionPid || queryPid;

    if (!patientId) {
      return NextResponse.json(
        { error: "Not logged in as a patient (missing patient_id)." },
        { status: 401 }
      );
    }

    // 2) Fetch SIGNED prescriptions (newest first)
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
      .eq("patient_id", patientId)
      .eq("status", "signed")
      .order("created_at", { ascending: false });

    if (rxErr) {
      return NextResponse.json({ error: rxErr.message }, { status: 500 });
    }

    if (!rxList?.length) {
      return NextResponse.json({ prescriptions: [] });
    }

    // 3) Fetch all items for these prescriptions in a single call
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

    // 4) Group items by prescription_id and attach
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

// app/api/patient/prescriptions/route.ts
// Return all SIGNED prescriptions for the logged-in patient (newest first).
// For local dev, also accepts ?patient_id=<id> if no cookie is present.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";

async function getPatientIdFromCookies(): Promise<string | null> {
  const jar = await cookies(); // <-- await in this Next.js version

  // Support either a structured cookie like { patient_id } or a plain "patient_id" cookie
  const pidCookie = jar.get("patient_id")?.value;
  if (pidCookie) return pidCookie;

  const auth = jar.get("patient_auth")?.value || jar.get("patient")?.value;
  if (auth) {
    try {
      const obj = JSON.parse(auth);
      if (obj?.patient_id) return String(obj.patient_id);
    } catch {
      // ignore malformed cookie
    }
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const supabase = getSupabase();

    // 1) Resolve patient_id: cookie first, else ?patient_id= (dev fallback)
    const cookiePid = await getPatientIdFromCookies();
    const queryPid = url.searchParams.get("patient_id");
    const patientId = (cookiePid || queryPid || "").trim();

    if (!patientId) {
      return NextResponse.json(
        { error: "Not logged in as a patient (missing patient_id)." },
        { status: 401 }
      );
    }

    // 2) Fetch signed prescriptions (newest first)
    const { data: rxList, error: rxErr } = await supabase
      .from("prescriptions")
      .select(
        "id, patient_id, doctor_id, status, show_prices, notes_for_patient, discount_type, discount_value, discount_expires_at, discount_applied_by, created_at"
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

    // 3) Get all items for these prescriptions in one call
    const ids = rxList.map((r) => r.id);
    const { data: items, error: itErr } = await supabase
      .from("prescription_items")
      .select(
        "id, prescription_id, med_id, generic_name, strength, form, route, dose_amount, dose_unit, frequency_code, duration_days, quantity, instructions, unit_price"
      )
      .in("prescription_id", ids)
      .order("created_at", { ascending: true });

    if (itErr) {
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    // 4) Group items by prescription_id
    const byRx = new Map<string, any[]>();
    for (const it of items || []) {
      const arr = byRx.get(it.prescription_id) || [];
      arr.push(it);
      byRx.set(it.prescription_id, arr);
    }

    // 5) Attach items to each prescription
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

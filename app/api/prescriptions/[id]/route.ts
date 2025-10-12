// app/api/prescriptions/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Build a signed, absolute URL string for a private signature file.
// Always return a STRING (never an object), or null.
async function getSignedSignatureUrl(
  db: ReturnType<typeof getSupabase>,
  key?: string | null
): Promise<string | null> {
  if (!key) return null;

  // If somehow an object sneaks in, try to unwrap the most likely field.
  if (typeof key !== "string") {
    try {
      const anyKey = (key as any)?.signedUrl ?? (key as any)?.url ?? String(key);
      if (typeof anyKey === "string") key = anyKey;
    } catch { /* ignore */ }
  }

  // Already absolute?
  if (typeof key === "string" && /^https?:\/\//i.test(key)) return key;

  try {
    const { data, error } = await db.storage
      .from("dr_signatures")             // <-- your PRIVATE bucket
      .createSignedUrl(String(key), 60 * 60 * 12); // 12h validity
    if (error) {
      console.warn("Signed URL error:", error.message);
      return null;
    }
    return data?.signedUrl ?? null;      // <-- ensure we return a STRING
  } catch (e) {
    console.warn("Signed URL exception:", e);
    return null;
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const db = getSupabase();
  const rxId = params.id;

  // 1) Rx
  const rx = await db
    .from("prescriptions")
    .select("id, consultation_id, patient_id, doctor_id, status, notes_for_patient, created_at")
    .eq("id", rxId)
    .maybeSingle();
  if (rx.error) return NextResponse.json({ error: rx.error.message }, { status: 400 });
  if (!rx.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 2) Items
  const items = await db
    .from("prescription_items")
    .select("id, prescription_id, med_id, generic_name, brand_name, strength, form, route, dose_amount, dose_unit, frequency_code, duration_days, quantity, instructions, unit_price")
    .eq("prescription_id", rxId)
    .order("created_at", { ascending: true });
  if (items.error) return NextResponse.json({ error: items.error.message }, { status: 400 });

  // 3) Patient
  const patient = await db
    .from("patients")
    .select("patient_id, full_name, sex, birthday")
    .eq("patient_id", rx.data.patient_id)
    .maybeSingle();

  // 4) Doctor — query by doctor_id, alias to what the print page expects
  let doctor: any = null;
  const docKey = rx.data.doctor_id ?? null;

  if (docKey) {
    const d = await db
      .from("doctors")
      .select(
        // changed: alias credentials -> designations, signature_image_url -> signature_url
        "doctor_id, display_name, designations:credentials, prc_no, signature_url:signature_image_url"
      )
      .eq("doctor_id", docKey)
      .maybeSingle();
    if (!d.error && d.data) {
      doctor = d.data;
      doctor.signature_url = await getSignedSignatureUrl(db, doctor.signature_url);
    }
  }

  // Fallback to consultation snapshot if still null
  if (!doctor) {
    const c = await db
      .from("consultations")
      .select("doctor_id, doctor_name_at_time")
      .eq("id", rx.data.consultation_id)
      .maybeSingle();

    if (!c.error && c.data) {
      if (!doctor && c.data.doctor_id && c.data.doctor_id !== docKey) {
        const d2 = await db
          .from("doctors")
          .select(
            // same aliases here
            "doctor_id, display_name, designations:credentials, prc_no, signature_url:signature_image_url"
          )
          .eq("doctor_id", c.data.doctor_id)
          .maybeSingle();
        if (!d2.error) doctor = d2.data ?? null;
        if (!d2.error && d2.data) {
          doctor = d2.data;
          doctor.signature_url = await getSignedSignatureUrl(db, doctor.signature_url);
        }
      }  
    }
  }

  return NextResponse.json({
    id: rx.data.id,
    created_at: rx.data.created_at,
    status: rx.data.status,
    notes_for_patient: rx.data.notes_for_patient ?? "",
    patient: patient.data ?? null,
    doctor, // now has display_name / prc_no / signature_url
    items: items.data ?? [],
  });
}

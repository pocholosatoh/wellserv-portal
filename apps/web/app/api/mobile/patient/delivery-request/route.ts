import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  patientId?: string;
  patient_id?: string;
};

function hasAddress(row: any) {
  return Boolean(
    row &&
      String(row.delivery_address_label || "").trim() &&
      String(row.delivery_address_text || "").trim() &&
      row.delivery_lat !== null &&
      row.delivery_lat !== undefined &&
      row.delivery_lng !== null &&
      row.delivery_lng !== undefined,
  );
}

export async function POST(req: Request) {
  try {
    const auth = await guard(req, {
      allow: ["patient"],
      allowMobileToken: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as Body;
    const patientId = auth.patientId || body?.patientId || body?.patient_id;
    if (!patientId) {
      return NextResponse.json({ error: "patientId required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: existing, error: existingError } = await supabase
      .from("patients")
      .select(
        "patient_id, full_name, delivery_address_label, delivery_address_text, delivery_lat, delivery_lng, delivery_notes, last_delivery_used_at, last_delivery_success_at",
      )
      .eq("patient_id", patientId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    if (!hasAddress(existing)) {
      return NextResponse.json(
        { error: "Please save your delivery address first." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("patients")
      .update({ last_delivery_used_at: now })
      .eq("patient_id", patientId)
      .select(
        "patient_id, full_name, delivery_address_label, delivery_address_text, delivery_lat, delivery_lng, delivery_notes, last_delivery_used_at, last_delivery_success_at",
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message:
        "Your delivery request has been received. A WELLSERV representative will call to confirm your order.",
      patient: data,
    });
  } catch (e: any) {
    console.error("[mobile] delivery-request error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

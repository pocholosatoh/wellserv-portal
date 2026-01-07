import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

const PATIENT_FIELDS = [
  "patient_id",
  "full_name",
  "age",
  "sex",
  "birthday",
  "contact",
  "address",
  "email",
  "height_ft",
  "height_inch",
  "weight_kg",
  "systolic_bp",
  "diastolic_bp",
  "chief_complaint",
  "present_illness_history",
  "past_medical_history",
  "past_surgical_history",
  "allergies_text",
  "medications_current",
  "family_hx",
  "smoking_hx",
  "alcohol_hx",
  "last_updated",
  "created_at",
  "updated_at",
].join(",");

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"] });
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const patient_id = String(body?.patient_id || "").trim();
    const full_name = String(body?.full_name || "").trim();
    const birthday = String(body?.birthday || "").trim();

    if (!patient_id || !full_name || !birthday) {
      return NextResponse.json({ error: "patient_id, full_name, birthday required" }, { status: 400 });
    }

    const db = getSupabase();
    const { data, error } = await db
      .from("patients")
      .insert({ patient_id, full_name, birthday })
      .select(PATIENT_FIELDS)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patient: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

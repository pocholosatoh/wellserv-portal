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

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"], requirePatientId: true });
    if (!auth.ok) return auth.response;

    const patientId = String(auth.patientId || "").trim();
    if (!patientId) {
      return NextResponse.json({ error: "patient_id required" }, { status: 400 });
    }

    const db = getSupabase();
    const { data, error } = await db
      .from("patients")
      .select(PATIENT_FIELDS)
      .eq("patient_id", patientId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Patient ID not found." }, { status: 404 });
    }

    return NextResponse.json({ patient: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

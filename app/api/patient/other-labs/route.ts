// app/api/patient/other-labs/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get patient identity from httpOnly session (no query param needed)
    const s = await getSession();
    if (!s || s.role !== "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const patientId = String(s.patient_id).trim(); // canonical (UPPERCASE)

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("external_results")
      .select(
        "id, patient_id, url, content_type, type, provider, taken_at, uploaded_at, uploaded_by, note"
      )
      // DB stores uppercase; session.sub is uppercase. Use eq for speed; ilike also ok.
      .eq("patient_id", patientId)
      .order("type", { ascending: true })
      .order("taken_at", { ascending: false })
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    // Keep your original return shape: raw array
    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

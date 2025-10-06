// GET /api/consultations/list?patient_id=XYZ
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const patientId = (url.searchParams.get("patient_id") || "").trim();
    if (!patientId) return NextResponse.json({ error: "patient_id is required" }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("consultations")
      .select(`
        id, patient_id, visit_at, doctor_id,
        doctor:doctors (
          full_name, display_name, credentials, prc_no, ptr_no, s2_no, specialty, affiliations
        )
      `)
      .eq("patient_id", patientId)
      .order("visit_at", { ascending: false });

    if (error) throw error;

    // Optional: join doctor display name
    const docIds = Array.from(new Set((data || []).map(d => d.doctor_id).filter(Boolean)));
    let doctors: Record<string, string> = {};
    if (docIds.length) {
      const { data: docs } = await supabase
        .from("doctors")
        .select("doctor_id, display_name")
        .in("doctor_id", docIds as string[]);
      for (const d of docs || []) doctors[d.doctor_id as string] = d.display_name || "";
    }

    const rows = (data || []).map(r => ({ ...r, doctor_name: r.doctor_id ? doctors[r.doctor_id] || "" : "" }));
    return NextResponse.json({ consultations: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

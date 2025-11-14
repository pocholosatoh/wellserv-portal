import { NextResponse } from "next/server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getDoctorSession } from "@/lib/doctorSession";

export async function GET() {
  try {
    const doctor = await getDoctorSession().catch(() => null);
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supa = getSupabaseServer();
    const { data, error } = await supa
      .from("ecg_cases")
      .select("id, patient_id, encounter_id, uploaded_at, status, external_result_id")
      .order("uploaded_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

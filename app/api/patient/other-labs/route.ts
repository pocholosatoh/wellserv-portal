// app/api/patient/other-labs/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActor, getTargetPatientId } from "@/lib/api-actor";

// GET supports:
// - Patient portal: derives patient_id from session (no query needed)
// - Doctor/Staff:   must provide ?patient_id=... (or ?pid=...)
export async function GET(req: Request) {
  try {
    const actor = await requireActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve patient_id depending on actor
    const { searchParams } = new URL(req.url);
    const patient_id = getTargetPatientId(actor, { searchParams });

    if (!patient_id) {
      // For doctor/staff: require an explicit patient id
      return NextResponse.json({ error: "patient_id query param required" }, { status: 400 });
    }

    const pid = String(patient_id).trim().toUpperCase();

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("external_results")
      .select(
        "id, patient_id, url, content_type, type, provider, taken_at, uploaded_at, uploaded_by, note"
      )
      .eq("patient_id", pid)
      .order("type", { ascending: true })
      .order("taken_at", { ascending: false })
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    // Keep original return shape: raw array
    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

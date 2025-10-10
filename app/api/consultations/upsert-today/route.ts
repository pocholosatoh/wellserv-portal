// app/api/consultations/upsert-today/route.ts
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";

export async function POST(req: Request) {
  try {
    const { patientId } = await req.json();

    if (!patientId || typeof patientId !== "string") {
      return NextResponse.json({ error: "Missing or invalid patientId." }, { status: 400 });
    }

    const supabase = getSupabase();

    // ---- who is logged in (regular or reliever) ----
    const doctor = await getDoctorSession().catch(() => null);
    if (!doctor) {
      return NextResponse.json({ error: "Not logged in as doctor." }, { status: 401 });
    }

    // Build the display string we will snapshot, e.g. "Juan Dela Cruz, MD, FPCP"
    const doctorDisplay =
      doctor.display_name ||
      (doctor.credentials ? `${doctor.name}, ${doctor.credentials}` : doctor.name);

    // Only attach a doctor_id for regular doctors that exist in your doctors table.
    const maybeDoctorId = doctor.role === "regular" ? (doctor as any).id : null;

    // ---- compute today's window (local server time) ----
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    // ---- check if today's consultation already exists ----
    const { data: existing, error: selErr } = await supabase
      .from("consultations")
      .select("*")
      .eq("patient_id", patientId)
      .gte("visit_at", start.toISOString())
      .lte("visit_at", end.toISOString())
      .maybeSingle();

    if (selErr) {
      console.error("[upsert-today] select error:", selErr);
      return NextResponse.json({ error: selErr.message }, { status: 400 });
    }

    if (existing) {
      // already have one for today → return as-is
      return NextResponse.json({ consultation: existing });
    }

    // ---- create today's consultation ----
    const insertPayload: Record<string, any> = {
      patient_id: patientId,
      visit_at: now.toISOString(),
      // snapshot the reliever/doctor display name
      doctor_name_at_time: doctorDisplay || null,
    };

    // set doctor_id only if it's a regular doctor and you aren't setting it elsewhere
    if (maybeDoctorId) {
      insertPayload.doctor_id = maybeDoctorId;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("consultations")
      .insert(insertPayload)
      .select()
      .single();

    if (insErr) {
      console.error("[upsert-today] insert error:", insErr);
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ consultation: inserted });
  } catch (e: any) {
    console.error("[upsert-today] unexpected:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

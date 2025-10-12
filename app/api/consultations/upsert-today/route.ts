// app/api/consultations/upsert-today/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";

const PH_TZ = "Asia/Manila";

/** Build start/end Date objects for "today" in Asia/Manila */
function phDayWindow(d = new Date()) {
  // "YYYY-MM-DD" for PH date
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  // PH is UTC+08 with no DST. Use explicit offset so ISO is correct.
  const start = new Date(`${ymd}T00:00:00.000+08:00`);
  const end = new Date(`${ymd}T23:59:59.999+08:00`);
  return { start, end };
}

export async function POST(req: Request) {
  try {
    const doctor = await getDoctorSession();
    if (!doctor) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));

    // ✅ Normalize patient id to UPPERCASE before any DB use
    const patientId: string = String(body?.patientId || "").trim().toUpperCase();
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const db = getSupabase();
    const nowUtc = new Date();
    const { start, end } = phDayWindow(nowUtc);

    // 1) Reuse an existing consultation for this PH day, if present
    const reuse = await db
      .from("consultations")
      .select("id, patient_id, doctor_id, visit_at, doctor_name_at_time")
      .eq("patient_id", patientId) // ✅ uppercase
      .gte("visit_at", start.toISOString())
      .lte("visit_at", end.toISOString())
      .order("visit_at", { ascending: false })
      .maybeSingle();

    if (reuse.data?.id) {
      return NextResponse.json({ consultation: reuse.data, reused: true });
    }

    // 2) Otherwise create a new one
    //    - Real (known) doctor → set doctor_id
    //    - Reliever → store snapshot name in doctor_name_at_time
    const isRegular = doctor.role === "regular"; // your session sets this
    const snapshotName =
      !isRegular
        ? (doctor.display_name ||
           (doctor.credentials ? `${doctor.name}, ${doctor.credentials}` : doctor.name) ||
           null)
        : null;

    const ins = await db
      .from("consultations")
      .insert({
        patient_id: patientId,                             // ✅ uppercase
        visit_at: nowUtc.toISOString(),
        doctor_id: isRegular ? (doctor as any).id : null,  // only for known doctors
        doctor_name_at_time: snapshotName,                 // for relievers
      })
      .select("id, patient_id, doctor_id, visit_at, doctor_name_at_time")
      .single();

    if (ins.error) {
      return NextResponse.json({ error: ins.error.message }, { status: 400 });
    }

    return NextResponse.json({ consultation: ins.data, reused: false });
    // after you set the new consultationId in state:
    window.dispatchEvent(new CustomEvent("consultation:updated", { detail: { patientId } }));

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

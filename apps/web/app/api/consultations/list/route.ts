// app/api/consultations/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

/**
 * GET /api/consultations/list?patient_id=SATOH010596
 * Returns recent consultations for a patient, newest first.
 */
export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff", "doctor"], requirePatientId: true });
    if (!auth.ok) return auth.response;
    const url = new URL(req.url);
    const raw = (auth.patientId || "").trim();
    // Normalize to uppercase so it matches how upsert-today inserts
    const patientId = raw.toUpperCase();

    const db = getSupabase();

    // Pull consultations for this patient
    const cons = await db
      .from("consultations")
      .select(
        `
        id,
        patient_id,
        doctor_id,
        visit_at,
        plan_shared,
        doctor_name_at_time
      `,
      )
      .eq("patient_id", patientId)
      .order("visit_at", { ascending: false });

    if (cons.error) {
      return NextResponse.json({ error: cons.error.message }, { status: 400 });
    }

    const rows = cons.data || [];

    // Attach doctor light profiles (by doctor_id, using your doctors.doctor_id PK)
    const doctorIds = Array.from(new Set(rows.map((r) => r.doctor_id).filter(Boolean))) as string[];

    let doctorMap: Record<
      string,
      { display_name?: string | null; full_name?: string | null; credentials?: string | null }
    > = {};

    if (doctorIds.length) {
      const docs = await db
        .from("doctors")
        .select("doctor_id, display_name, full_name, credentials")
        .in("doctor_id", doctorIds);

      if (!docs.error && docs.data) {
        for (const d of docs.data) {
          doctorMap[d.doctor_id] = {
            display_name: d.display_name,
            full_name: d.full_name,
            credentials: d.credentials,
          };
        }
      }
    }

    const consultations = rows.map((r) => ({
      id: r.id,
      patient_id: r.patient_id,
      doctor_id: r.doctor_id,
      visit_at: r.visit_at,
      plan_shared: r.plan_shared ?? false,
      doctor_name_at_time: r.doctor_name_at_time ?? null,
      doctor: r.doctor_id ? (doctorMap[r.doctor_id] ?? null) : null,
    }));

    return NextResponse.json({ consultations });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

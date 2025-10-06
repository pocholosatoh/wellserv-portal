// app/api/consultations/upsert-today/route.ts
// Ensure exactly ONE consultation per patient per PH day (Asia/Manila).
// If today's consult exists, return it; otherwise create one.
// Safe on double-calls: if insert hits unique-constraint, we re-select and return.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { patientId } = await req.json();
    if (!patientId) {
      return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    // doctor_id from cookie (optional)
    const jar = await cookies();
    const auth = jar.get("doctor_auth")?.value;
    let doctorId: string | null = null;
    if (auth) {
      try {
        const obj = JSON.parse(auth);
        doctorId = obj?.doctor_id ?? null;
      } catch {}
    }

    const supabase = getSupabase();

    // 1) Does a consult already exist for *today in Asia/Manila*?
    //    WHERE (visit_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
    const { data: existing, error: findErr } = await supabase
      .rpc("consult_find_today_ph", { p_patient_id: patientId }); // we’ll add this helper below
    if (findErr) {
      // Fallback without RPC if extension not yet created
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .eq("patient_id", patientId)
        .order("visit_at", { ascending: false });
      if (error) throw error;
      // manual filter for PH day
      const now = new Date();
      const phNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const phDay = phNow.toISOString().slice(0, 10);
      const today = (data || []).find((c: any) => {
        const cPH = new Date(new Date(c.visit_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        return cPH.toISOString().slice(0, 10) === phDay;
      });
      if (today) {
        return NextResponse.json({ consultation: today });
      }
    } else if (Array.isArray(existing) && existing.length) {
      // RPC returns a list, newest first
      return NextResponse.json({ consultation: existing[0] });
    }

    // 2) Create today's consultation (visit_at = now UTC; uniqueness is enforced per PH day)
    const toInsert = {
      patient_id: patientId,
      doctor_id: doctorId,
      visit_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await supabase
      .from("consultations")
      .insert(toInsert)
      .select("*")
      .single();

    if (insErr) {
      // If another call inserted first (or the unique idx fired), re-select and return it.
      // Unique code is 23505.
      // Re-query today's consult in PH.
      const { data: again, error: againErr } = await supabase
        .rpc("consult_find_today_ph", { p_patient_id: patientId });
      if (againErr) {
        // fallback again
        const { data, error } = await supabase
          .from("consultations")
          .select("*")
          .eq("patient_id", patientId)
          .order("visit_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        return NextResponse.json({ consultation: (data || [])[0] ?? null });
      }
      return NextResponse.json({ consultation: (again || [])[0] ?? null });
    }

    return NextResponse.json({ consultation: inserted });
  } catch (e: any) {
    console.error("[consultations/upsert-today]", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

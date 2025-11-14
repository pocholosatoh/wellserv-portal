// app/api/doctor/consultations/finalize/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";

export async function POST(req: Request) {
  const db = getSupabase();
  try {
    // Auth: doctor session (as in your original)
    const sess = await getDoctorSession();
    if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const consultation_id = String(body?.consultation_id || body?.consultationId || "").trim();
    const encounter_id = String(body?.encounter_id || body?.encounterId || "").trim();

    if (!consultation_id || !encounter_id) {
      return NextResponse.json({ error: "consultation_id and encounter_id are required." }, { status: 400 });
    }

    // 1) Block finalize if any prescription exists (draft OR signed)
    const { data: rxAny, error: rxErr } = await db
      .from("prescriptions")
      .select("id,status")
      .eq("consultation_id", consultation_id)
      .in("status", ["draft", "signed"])
      .limit(1);

    if (rxErr) {
      return NextResponse.json({ error: rxErr.message }, { status: 400 });
    }
    if (rxAny && rxAny.length > 0) {
      return NextResponse.json(
        {
          error:
            "A prescription already exists for this consultation. Sign it or delete the draft to finish.",
        },
        { status: 409 }
      );
    }

    // 2) Mark consultation as done (no Rx path)
    const up1 = await db
      .from("consultations")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", consultation_id);

    if (up1.error) {
      return NextResponse.json({ error: up1.error.message }, { status: 400 });
    }

    // 3) Update encounter consult_status only (do NOT change main lab status here)
    const up2 = await db
      .from("encounters")
      .update({
        // consult_status: "done",
        current_consultation_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", encounter_id);

    if (up2.error) {
      return NextResponse.json({ error: up2.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

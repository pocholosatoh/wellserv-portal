// app/api/prescriptions/sign/route.ts
// Marks the draft prescription for a consultation as 'signed' (visible to patient/staff)

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { consultationId } = await req.json();
    if (!consultationId) {
      return NextResponse.json({ error: "Missing consultationId" }, { status: 400 });
    }

    const cookie = (await cookies()).get("doctor_auth")?.value;
    if (!cookie) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const doc = JSON.parse(cookie);
    const doctorId = doc?.doctor_id as string | undefined;

    // Find draft
    const { data: draft, error: qErr } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("consultation_id", consultationId)
      .eq("status", "draft")
      .limit(1)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!draft) return NextResponse.json({ error: "No draft prescription to sign." }, { status: 400 });

    // Require at least one item
    const { count, error: cntErr } = await supabase
      .from("prescription_items")
      .select("id", { count: "exact", head: true })
      .eq("prescription_id", draft.id);
    if (cntErr) throw cntErr;
    if (!count || count === 0) {
      return NextResponse.json({ error: "Cannot sign an empty prescription." }, { status: 400 });
    }

    const { error: updErr } = await supabase
      .from("prescriptions")
      .update({ status: "signed", doctor_id: doctorId ?? draft.doctor_id })
      .eq("id", draft.id);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, prescription_id: draft.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

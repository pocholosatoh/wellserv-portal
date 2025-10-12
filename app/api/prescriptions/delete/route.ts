export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";

export async function POST(req: Request) {
  try {
    const doc = await getDoctorSession();
    if (!doc) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { consultationId } = await req.json();
    if (!consultationId) {
      return NextResponse.json({ error: "consultationId is required" }, { status: 400 });
    }

    const db = getSupabase();

    // Find draft Rx by consultation
    const rx = await db
      .from("prescriptions")
      .select("id")
      .eq("consultation_id", consultationId)
      .eq("status", "draft")
      .maybeSingle();

    if (!rx.data?.id) {
      return NextResponse.json({ ok: true }); // nothing to delete
    }

    const rxId = rx.data.id;

    // Delete items first unless you have ON DELETE CASCADE
    const delItems = await db.from("prescription_items").delete().eq("prescription_id", rxId);
    if (delItems.error) {
      return NextResponse.json({ error: delItems.error.message }, { status: 400 });
    }

    const delRx = await db.from("prescriptions").delete().eq("id", rxId);
    if (delRx.error) {
      return NextResponse.json({ error: delRx.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

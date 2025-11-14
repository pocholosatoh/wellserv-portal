export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor } from "@/lib/api-actor";

export async function POST(req: Request) {
  try {
    const actor = await requireActor();
    if (!actor || actor.kind === "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { consultation_id, code } = await req.json();
    if (!consultation_id || !code) {
      return NextResponse.json({ error: "consultation_id and code required" }, { status: 400 });
    }

    const db = getSupabase();
    const del = await db
      .from("consultation_diagnoses")
      .delete()
      .eq("consultation_id", consultation_id)
      .eq("icd10_code", String(code).toUpperCase());

    if (del.error) {
      return NextResponse.json({ error: del.error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

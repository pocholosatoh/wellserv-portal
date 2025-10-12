// app/api/doctor-notes/get/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const consultationId = url.searchParams.get("consultation_id");
    if (!consultationId) {
      return NextResponse.json({ error: "consultation_id is required" }, { status: 400 });
    }

    const db = getSupabase();

    // One row per consultation (latest by updated_at just in case)
    const r = await db
      .from("doctor_notes")
      .select("notes_markdown, notes_soap, updated_at")
      .eq("consultation_id", consultationId)
      .order("updated_at", { ascending: false })
      .maybeSingle();

    if (r.error) {
      return NextResponse.json({ error: r.error.message }, { status: 400 });
    }

    return NextResponse.json({
      notes_markdown: r.data?.notes_markdown ?? null,
      notes_soap: r.data?.notes_soap ?? null,
      updated_at: r.data?.updated_at ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

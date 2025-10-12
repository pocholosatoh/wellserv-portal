export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";

// tiny helper: is a string a v4/v1 uuid?
function isUuid(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  try {
    const doctor = await getDoctorSession();
    if (!doctor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const consultationId = body?.consultationId ?? body?.consultation_id;

    // While the page is still preparing the consultation, quietly no-op
    if (!consultationId) {
      return NextResponse.json({ ok: false, reason: "consultation_not_ready" }, { status: 200 });
    }

    const db = getSupabase();

    // Normalize inputs – accept either {mode, notesMarkdown/notesSOAP} or direct fields
    let notes_markdown: string | null = null;
    let notes_soap: any | null = null;
    if (body?.mode === "markdown") {
      notes_markdown = body?.notesMarkdown ?? body?.notes_markdown ?? null;
    } else if (body?.mode === "soap") {
      notes_soap = body?.notesSOAP ?? body?.notes_soap ?? null;
    } else {
      notes_markdown = body?.notesMarkdown ?? body?.notes_markdown ?? null;
      notes_soap = body?.notesSOAP ?? body?.notes_soap ?? null;
    }

    // Who wrote it? Only set created_by if it is a real UUID doctor id,
    // otherwise leave NULL (reliever ids like "relief_xxx" would break the FK).
    const createdBy = isUuid((doctor as any)?.id) ? (doctor as any).id : null;

    // Upsert by consultation_id (1 row per consultation)
    const existing = await db
      .from("doctor_notes")
      .select("id")
      .eq("consultation_id", consultationId)
      .maybeSingle();

    if (existing.data?.id) {
      const upd = await db
        .from("doctor_notes")
        .update({
          notes_markdown,
          notes_soap,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id)
        .select("id")
        .single();

      if (upd.error) {
        return NextResponse.json({ error: upd.error.message }, { status: 400 });
      }
    } else {
      const ins = await db
        .from("doctor_notes")
        .insert({
          consultation_id: consultationId,
          notes_markdown,
          notes_soap,
          created_by: createdBy, // NULL for relievers (FK stays valid)
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (ins.error) {
        return NextResponse.json({ error: ins.error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

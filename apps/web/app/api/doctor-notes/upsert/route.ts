// app/api/doctor-notes/upsert/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor } from "@/lib/api-actor"; // ← accept doctor or staff (not patients)

// tiny helper: is a string a v4/v1 uuid?
function isUuid(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type UpsertBody = {
  consultationId?: string;
  consultation_id?: string;
  mode?: "markdown" | "soap";
  notesMarkdown?: string | null;
  notes_markdown?: string | null;
  notesSOAP?: any | null;
  notes_soap?: any | null;
};

export async function POST(req: Request) {
  try {
    // Auth: allow DOCTOR or STAFF; deny patient
    const actor = await requireActor();
    if (!actor || actor.kind === "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabase();

    const body = (await req.json().catch(() => ({}))) as UpsertBody;
    const consultationId = body?.consultationId ?? body?.consultation_id;

    // While the page is still preparing the consultation, quietly no-op
    if (!consultationId) {
      return NextResponse.json(
        { ok: false, reason: "consultation_not_ready" },
        { status: 200 }
      );
    }

    // (Optional but safer) verify the consultation exists
    const { data: cons, error: cErr } = await db
      .from("consultations")
      .select("id")
      .eq("id", consultationId)
      .maybeSingle();

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 400 });
    }
    if (!cons?.id) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    // Normalize inputs – accept either {mode, notesMarkdown/notesSOAP} or direct fields
    let notes_markdown: string | null = null;
    let notes_soap: any | null = null;

    if (body?.mode === "markdown") {
      notes_markdown = (body?.notesMarkdown ?? body?.notes_markdown ?? null) || null;
    } else if (body?.mode === "soap") {
      notes_soap = body?.notesSOAP ?? body?.notes_soap ?? null;
    } else {
      notes_markdown = (body?.notesMarkdown ?? body?.notes_markdown ?? null) || null;
      notes_soap = body?.notesSOAP ?? body?.notes_soap ?? null;
    }

    // Who wrote it?
    // - If actor is DOCTOR and has a real UUID id → set created_by (FK ok)
    // - If actor is reliever (id like "relief_xxx") or STAFF → leave NULL to avoid FK break
    let createdBy: string | null = null;
    if (actor.kind === "doctor" && isUuid(actor.id)) {
      createdBy = actor.id;
    }

    // Upsert by consultation_id (one row per consultation)
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
          created_by: createdBy, // NULL for relievers/staff (FK stays valid)
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
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

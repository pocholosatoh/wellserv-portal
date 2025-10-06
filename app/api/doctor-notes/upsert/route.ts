// app/api/doctor-notes/upsert/route.ts
// Upserts notes for a consultation. Accepts Markdown or SOAP JSON.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { consultationId, mode, notesMarkdown, notesSOAP } = await req.json();

    if (!consultationId) {
      return NextResponse.json({ error: "Missing consultationId" }, { status: 400 });
    }

    // Auth (doctor cookie)
    const cookie = (await cookies()).get("doctor_auth")?.value;
    if (!cookie) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const doc = JSON.parse(cookie);
    const doctorId = doc?.doctor_id as string | undefined;

    // Does a notes row already exist?
    const { data: existing, error: qErr } = await supabase
      .from("doctor_notes")
      .select("*")
      .eq("consultation_id", consultationId)
      .limit(1)
      .maybeSingle();

    if (qErr) throw qErr;

    const payload: any = { consultation_id: consultationId };
    if (mode === "markdown") {
      payload.notes_markdown = notesMarkdown ?? "";
    } else if (mode === "soap") {
      payload.notes_soap = notesSOAP ?? { S: "", O: "", A: "", P: "" };
    }
    if (!existing) payload.created_by = doctorId;

    if (existing) {
      const { data, error } = await supabase
        .from("doctor_notes")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, notes: data });
    } else {
      const { data, error } = await supabase
        .from("doctor_notes")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, notes: data });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

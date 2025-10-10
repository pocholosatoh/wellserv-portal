import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1) Load the consultation row (adjust selected columns as you like)
    const { data: consultation, error: cErr } = await supabase
      .from("consultations")
      .select("id, patient_id, doctor_id, visit_at")
      .eq("id", id)
      .single();

    if (cErr || !consultation) {
      return NextResponse.json(
        { error: cErr?.message || "Consultation not found" },
        { status: 404 }
      );
    }

    // 2) Load notes (either markdown or SOAP JSON)
    // If your table is named differently, change "consultation_notes" below.
    const { data: notesRow } = await supabase
      .from("doctor_notes")
      .select("notes_markdown, notes_soap")
      .eq("consultation_id", id)
      .maybeSingle();

    const notes = notesRow || null;

    // 3) Load prescriptions + items
    // If your schema differs, adjust names:
    //   prescriptions table and prescription_items child table.
    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select("id, status, notes_for_patient, created_at, items:prescription_items(*)")
      .eq("consultation_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      consultation,
      notes,
      prescriptions: prescriptions || [],
    });
  } catch (e: any) {
    console.error("GET /api/consultations/details error:", e);
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

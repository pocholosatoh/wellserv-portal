// app/api/consultations/details/route.ts
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = (url.searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Missing consultation id" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1) Load consultation itself
    const { data: consultation, error: consultErr } = await supabase
      .from("consultations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (consultErr) throw consultErr;
    if (!consultation)
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });

    // 2) Load notes tied to this consultation_id only
    const { data: notes } = await supabase
      .from("doctor_notes")
      .select("*")
      .eq("consultation_id", id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3) Load prescriptions tied strictly to this consultation_id
    const { data: prescriptions, error: rxErr } = await supabase
      .from("prescriptions")
      .select(
        "id, consultation_id, patient_id, doctor_id, status, show_prices, notes_for_patient, created_at"
      )
      .eq("consultation_id", id)
      .order("created_at", { ascending: false });

    if (rxErr) throw rxErr;

    // 4) Gather prescription_items for those Rx only
    let itemsByRx: Record<string, any[]> = {};
    if (prescriptions && prescriptions.length) {
      const ids = prescriptions.map((r) => r.id);
      const { data: items } = await supabase
        .from("prescription_items")
        .select("*")
        .in("prescription_id", ids)
        .order("created_at", { ascending: true });

      for (const it of items || []) {
        (itemsByRx[it.prescription_id] ||= []).push(it);
      }
    }

    const presWithItems = (prescriptions || []).map((r) => ({
      ...r,
      items: itemsByRx[r.id] || [],
    }));

    return NextResponse.json({
      consultation,
      notes: notes || null,
      prescriptions: presWithItems,
    });
  } catch (e: any) {
    console.error("[consultations/details]", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

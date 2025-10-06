// app/api/staff/prescriptions/route.ts
// GET /api/staff/prescriptions?patient_id=XYZ
// Returns SIGNED prescriptions + their items for the given patient_id.

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const patientId = (url.searchParams.get("patient_id") || "").trim();
    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1) Pull signed prescriptions for this patient
    const { data: rx, error: rxErr } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("patient_id", patientId)
      .eq("status", "signed")
      .order("created_at", { ascending: false });

    if (rxErr) throw rxErr;
    if (!rx || rx.length === 0) return NextResponse.json({ prescriptions: [] });

    const ids = rx.map(r => r.id);

    // 2) Pull items for those prescriptions
    const { data: items, error: itErr } = await supabase
      .from("prescription_items")
      .select("*")
      .in("prescription_id", ids)
      .order("created_at", { ascending: true });

    if (itErr) throw itErr;

    // Group items by prescription_id
    const byRx: Record<string, any[]> = {};
    for (const it of items || []) {
      const k = it.prescription_id;
      (byRx[k] ||= []).push(it);
    }

    // Attach
    const result = rx.map(r => ({
      ...r,
      items: byRx[r.id] || [],
    }));

    return NextResponse.json({ prescriptions: result });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

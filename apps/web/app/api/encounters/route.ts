import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const patient_id = url.searchParams.get("patient_id");
    if (!patient_id) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const supa = getSupabaseServer();

    // ✅ Select all columns to avoid unknown-column errors
    const { data, error } = await supa
      .from("encounters")            // <— change this table name if you use a different one
      .select("*")
      .eq("patient_id", patient_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Map to a safe, UI-friendly shape, tolerating missing fields
    const items = (data || []).map((row: any) => ({
      id: row.id,
      patient_id: row.patient_id,
      created_at: row.created_at ?? row.inserted_at ?? row.createdAt ?? null,
      branch: row.branch ?? row.branch_code ?? row.site ?? null,
      reason: row.reason ?? row.purpose ?? null,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

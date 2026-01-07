import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["patient", "staff", "doctor"], requirePatientId: true });
    if (!auth.ok) return auth.response;

    const supa = getSupabaseServer();

    // ✅ Select all columns to avoid unknown-column errors
    const { data, error } = await supa
      .from("encounters") // <— change this table name if you use a different one
      .select("*")
      .eq("patient_id", auth.patientId)
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

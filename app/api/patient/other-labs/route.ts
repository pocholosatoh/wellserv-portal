// app/api/patient/other-labs/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidPatientId(pid: string) {
  return /^[A-Za-z0-9_-]{3,64}$/.test(pid);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("patient_id")?.trim() || "";
    if (!raw || !isValidPatientId(raw)) {
      return NextResponse.json({ error: "Invalid or missing patient_id" }, { status: 400 });
    }

    // Case-insensitive exact match via ILIKE (no wildcards)
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("external_results")
      .select("id, patient_id, url, content_type, provider, taken_at, uploaded_at, uploaded_by, note")
      .ilike("patient_id", raw)               // 👈 case-insensitive compare
      .order("taken_at", { ascending: false })
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

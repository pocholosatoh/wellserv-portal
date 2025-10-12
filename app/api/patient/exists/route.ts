// app/api/patient/exists/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Change this if your table/column is named differently:
const TABLE = "patients";        // <- e.g., "patients"
const COL   = "patient_id";      // <- e.g., "patient_id"

function isValid(pid: string) {
  return /^[A-Za-z0-9_-]{3,64}$/.test(pid);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get("patient_id") || "").trim();
    if (!raw || !isValid(raw)) {
      return NextResponse.json({ exists: false, reason: "invalid" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from(TABLE)
      .select(COL)
      .ilike(COL, raw)
      .limit(1);

    if (error) throw error;
    const exists = Array.isArray(data) && data.length > 0;
    return NextResponse.json({ exists });
  } catch (e: any) {
    return NextResponse.json({ exists: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

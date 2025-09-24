// app/api/patient-exists/route.ts
import { NextResponse } from "next/server";
import { sbReadPatientById } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const patient_id = String(body?.patient_id || "").trim();
  if (!patient_id) return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });

  try {
    const p = await sbReadPatientById(patient_id); // case-insensitive (ilike) in lib/supabase.ts
    if (!p) return NextResponse.json({ exists: false }, { status: 404 });
    return NextResponse.json({ exists: true, full_name: p.full_name || "" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const patient_id = String(searchParams.get("patient_id") || "").trim();
  if (!patient_id) return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });
  return POST(
    new Request(req.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ patient_id }),
    })
  );
}

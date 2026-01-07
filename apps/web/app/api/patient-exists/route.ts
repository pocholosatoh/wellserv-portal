// app/api/patient-exists/route.ts
import { NextResponse } from "next/server";
import { sbReadPatientById } from "@/lib/supabase";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";

async function rateLimit(req: Request) {
  const ip = getRequestIp(req);
  const key = `lookup:patient-exists:${ip}`;
  const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }
  return null;
}

export async function POST(req: Request) {
  const limited = await rateLimit(req);
  if (limited) return limited;

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
  const limited = await rateLimit(req);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const patient_id = String(searchParams.get("patient_id") || "").trim();
  if (!patient_id) return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });
  return POST(
    new Request(req.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ patient_id }),
    }),
  );
}

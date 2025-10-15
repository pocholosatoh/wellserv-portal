// app/api/auth/patient/login/route.ts
import { NextResponse } from "next/server";
import { setSession } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,       // keep your project’s env names
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { patient_id: rawPid, access_code, remember } = await req.json();

  if (!rawPid || !access_code) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const expected = process.env.PATIENT_PORTAL_ACCESS_CODE;
  if (!expected) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  if (access_code !== expected) return NextResponse.json({ error: "Invalid access code" }, { status: 401 });

  // Normalize user input (DB stores uppercase; accept any case from user)
  const input = String(rawPid).trim();
  const target = input.toUpperCase();

  // Look up by patients.patient_id (case-insensitive)
  const { data: row, error } = await supabase
    .from("patients")
    .select("patient_id, full_name")
    .ilike("patient_id", target) // ILIKE is case-insensitive
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "No matching Patient ID" }, { status: 404 });
  }

  // Set cookie session to the canonical patient_id (UPPERCASE from DB)
  await setSession(
    { sub: row.patient_id, role: "patient", name: row.full_name ?? null },
    remember ? 30 : 7
  );

  return NextResponse.json({ ok: true });
}

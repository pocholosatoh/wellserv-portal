import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const key = `verify:medcert:${ip}`;
  const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const code = String(searchParams.get("code") || "").trim();
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("medical_certificates")
      .select(
        [
          "certificate_no",
          "patient_full_name",
          "patient_birthdate",
          "patient_age",
          "patient_sex",
          "issued_at",
          "valid_until",
          "status",
          "verification_code",
          "doctor_snapshot",
          "diagnosis_text",
          "remarks",
        ].join(", "),
      )
      .eq("verification_code", code)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ certificate: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

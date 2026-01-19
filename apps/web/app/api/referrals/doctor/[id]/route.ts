export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

function isUuid(value?: string | null) {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await guard(req, { allow: ["doctor", "staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid doctor id" }, { status: 400 });
    }

    const db = getSupabase();
    const doctorRes = await db
      .from("referral_doctors")
      .select("id, full_name, credentials, prc_no, specialty_id, is_active")
      .eq("id", id)
      .maybeSingle();

    if (doctorRes.error) {
      return NextResponse.json({ error: doctorRes.error.message }, { status: 400 });
    }
    if (!doctorRes.data) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }
    if (!doctorRes.data.is_active) {
      return NextResponse.json({ error: "Doctor not available" }, { status: 400 });
    }

    const specialtyRes = await db
      .from("referral_specialties")
      .select("id, code, name")
      .eq("id", doctorRes.data.specialty_id)
      .maybeSingle();

    const affRes = await db
      .from("referral_doctor_affiliations")
      .select(
        "id, referral_doctor_id, institution_name, address_line, contact_numbers, schedule_text, sort_order, is_active",
      )
      .eq("referral_doctor_id", id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("institution_name", { ascending: true });

    if (affRes.error) {
      return NextResponse.json({ error: affRes.error.message }, { status: 400 });
    }

    return NextResponse.json({
      doctor: {
        id: doctorRes.data.id,
        full_name: doctorRes.data.full_name,
        credentials: doctorRes.data.credentials ?? null,
        prc_no: doctorRes.data.prc_no ?? null,
        specialty: specialtyRes.data
          ? { id: specialtyRes.data.id, code: specialtyRes.data.code, name: specialtyRes.data.name }
          : null,
        affiliations: affRes.data ?? [],
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

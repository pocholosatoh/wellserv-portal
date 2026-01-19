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

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor", "staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const specialtyId = (url.searchParams.get("specialty_id") || "").trim();

    if (!specialtyId || !isUuid(specialtyId)) {
      return NextResponse.json({ error: "specialty_id is required" }, { status: 400 });
    }

    const db = getSupabase();

    const doctorsRes = await db
      .from("referral_doctors")
      .select("id, full_name, credentials, prc_no, specialty_id")
      .eq("specialty_id", specialtyId)
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (doctorsRes.error) {
      return NextResponse.json({ error: doctorsRes.error.message }, { status: 400 });
    }

    const doctors = doctorsRes.data ?? [];
    const doctorIds = doctors.map((row) => row.id).filter(Boolean);

    let affiliations: any[] = [];
    if (doctorIds.length) {
      const affRes = await db
        .from("referral_doctor_affiliations")
        .select(
          "id, referral_doctor_id, institution_name, address_line, contact_numbers, schedule_text, sort_order, is_active",
        )
        .in("referral_doctor_id", doctorIds)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("institution_name", { ascending: true });

      if (affRes.error) {
        return NextResponse.json({ error: affRes.error.message }, { status: 400 });
      }
      affiliations = affRes.data ?? [];
    }

    const affMap = new Map<string, any[]>();
    affiliations.forEach((row) => {
      const list = affMap.get(row.referral_doctor_id) ?? [];
      list.push(row);
      affMap.set(row.referral_doctor_id, list);
    });

    const payload = doctors.map((doc) => ({
      id: doc.id,
      full_name: doc.full_name,
      credentials: doc.credentials ?? null,
      prc_no: doc.prc_no ?? null,
      specialty_id: doc.specialty_id,
      affiliations: affMap.get(doc.id) ?? [],
    }));

    return NextResponse.json({ doctors: payload });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

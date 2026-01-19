export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

type SpecialtyRow = {
  id: string;
  code: string | null;
  name: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"] });
    if (!auth.ok) return auth.response;

    const db = getSupabase();

    const specialtiesRes = await db
      .from("referral_specialties")
      .select("id, code, name, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (specialtiesRes.error) {
      return NextResponse.json({ error: specialtiesRes.error.message }, { status: 400 });
    }

    const doctorsRes = await db
      .from("referral_doctors")
      .select("id, full_name, credentials, prc_no, specialty_id, is_active")
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

    const specialties = (specialtiesRes.data ?? []) as SpecialtyRow[];
    const specialtyMap = new Map<string, SpecialtyRow>();
    specialties.forEach((spec) => {
      specialtyMap.set(spec.id, spec);
    });

    const payload = doctors.map((doc) => {
      const specialty = specialtyMap.get(doc.specialty_id);
      return {
        id: doc.id,
        full_name: doc.full_name,
        credentials: doc.credentials ?? null,
        prc_no: doc.prc_no ?? null,
        specialty_id: doc.specialty_id,
        specialty_name: specialty?.name ?? null,
        specialty_code: specialty?.code ?? null,
        is_active: doc.is_active ?? null,
        affiliations: affMap.get(doc.id) ?? [],
      };
    });

    return NextResponse.json({ doctors: payload, specialties });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

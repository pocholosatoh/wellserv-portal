export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDoctorName(fullName?: string | null, credentials?: string | null) {
  const base = String(fullName || "").trim();
  const cred = String(credentials || "").trim();
  if (!base) return null;
  if (cred && !new RegExp(`,\\s*${escapeRegExp(cred)}$`).test(base)) {
    return `${base}, ${cred}`;
  }
  return base;
}

export async function GET(req: Request) {
  try {
    const auth = await guard(req, {
      allow: ["doctor", "staff"],
      requireBranch: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const patientId = (auth.patientId || "").trim().toUpperCase();
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 10) : 5;

    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const db = getSupabase();
    const res = await db
      .from("patient_referrals")
      .select(
        "id, referral_code, created_at, referred_to_doctor_id, referred_to_specialty_id, referred_to_affiliation_id",
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    const rows = res.data ?? [];
    const doctorIds = Array.from(new Set(rows.map((r) => r.referred_to_doctor_id).filter(Boolean)));
    const specialtyIds = Array.from(
      new Set(rows.map((r) => r.referred_to_specialty_id).filter(Boolean)),
    );

    const doctorMap = new Map<string, string>();
    if (doctorIds.length) {
      const docs = await db
        .from("referral_doctors")
        .select("id, full_name, credentials")
        .in("id", doctorIds);
      if (!docs.error && docs.data) {
        docs.data.forEach((doc) => {
          const label = formatDoctorName(doc.full_name, doc.credentials);
          if (label) doctorMap.set(doc.id, label);
        });
      }
    }

    const specialtyMap = new Map<string, string>();
    if (specialtyIds.length) {
      const specs = await db
        .from("referral_specialties")
        .select("id, name, code")
        .in("id", specialtyIds);
      if (!specs.error && specs.data) {
        specs.data.forEach((spec) => {
          const label = spec.name || spec.code || "";
          if (label) specialtyMap.set(spec.id, label);
        });
      }
    }

    const list = rows.map((row) => ({
      id: row.id,
      referral_code: row.referral_code,
      created_at: row.created_at,
      referred_to_doctor_id: row.referred_to_doctor_id,
      referred_to_specialty_id: row.referred_to_specialty_id,
      referred_to_affiliation_id: row.referred_to_affiliation_id,
      referred_to_doctor_name: doctorMap.get(row.referred_to_doctor_id) || null,
      referred_to_specialty_name: specialtyMap.get(row.referred_to_specialty_id) || null,
    }));

    return NextResponse.json({ referrals: list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { buildAllReports } from "@/lib/api/patient-results-core";
import { requireActor } from "@/lib/api-actor";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAccessAllowed(code: string | undefined | null) {
  const expected =
    process.env.PATIENT_PORTAL_ACCESS_CODE ||
    process.env.PATIENT_ACCESS_CODE;
  if (!expected) return true;
  return code === expected;
}

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

// Minimal mobile-friendly endpoint that reuses buildAllReports and returns the same shape
// as /api/patient-results. It now prefers an authenticated patient session but will still
// accept the legacy portal access code for older clients.
export async function POST(req: Request) {
  try {
    const actor = await requireActor().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const limit = body?.limit != null ? Number(body.limit) : undefined;
    const visitDateRaw = body?.visitDate || body?.visit_date || body?.date;
    const visitDate = visitDateRaw ? String(visitDateRaw) : undefined;

    let patientId: string | null = actor?.kind === "patient" ? actor.patient_id : null;

    if (!patientId) {
      patientId = body?.patientId || body?.patient_id || null;
      if (!patientId) {
        return NextResponse.json({ error: "patientId required" }, { status: 400 });
      }
    }

    const pid = String(patientId).trim();

    if (!actor) {
      const accessCode = body?.accessCode || body?.access_code;
      if (!isAccessAllowed(accessCode)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const supa = getSupabase();
      const pattern = escapeLikeExact(pid);
      const { data: patientRow, error } = await supa
        .from("patients")
        .select("pin_hash")
        .ilike("patient_id", pattern)
        .maybeSingle();

      if (error) throw error;
      if (patientRow?.pin_hash) {
        return NextResponse.json(
          { error: "Please log in with your PIN.", code: "PIN_REQUIRED" },
          { status: 403 }
        );
      }
    }

    const json = await buildAllReports(pid, limit, visitDate);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

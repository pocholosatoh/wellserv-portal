// app/api/consultations/upsert-today/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";
import { guard } from "@/lib/auth/guard";

function todayYMD(tz = process.env.APP_TZ || "Asia/Manila") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function isUuid(v?: string | null) {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function POST(req: Request) {
  try {
    const auth = await guard(req, {
      allow: ["doctor"],
      requireBranch: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;
    const actor = auth.actor;
    if (actor.kind !== "doctor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docSession = await getDoctorSession().catch(() => null);

    const patientId = String(auth.patientId || "").trim().toUpperCase();
    if (!patientId) {
      return NextResponse.json({ error: "patientId required" }, { status: 400 });
    }

    const db = getSupabase();

    // ---------- doctor identity & display ----------
    const doctor_id = actor.id; // may be relief_xxx
    const fallbackDisplay = (actor.display_name || actor.name || "").trim();
    let docNameRaw = fallbackDisplay;
    let docCreds = docSession?.credentials?.trim() || "";

    if (isUuid(doctor_id)) {
      const prof = await db
        .from("doctors")
        .select("display_name, full_name, credentials")
        .eq("doctor_id", doctor_id)
        .maybeSingle();
      if (!prof.error && prof.data) {
        docNameRaw = prof.data.display_name || prof.data.full_name || docNameRaw || "";
        docCreds = (prof.data.credentials || docCreds || "").trim();
      }
    }

    const baseName = (docNameRaw || fallbackDisplay || "").trim();
    const nameWithFallback = baseName || "Attending Doctor";
    const normalizedCreds = docCreds.trim();
    const hasCredSuffix = normalizedCreds
      ? new RegExp(`,\\s*${normalizedCreds}$`).test(nameWithFallback)
      : false;
    const display =
      normalizedCreds && !hasCredSuffix
        ? `${nameWithFallback}, ${normalizedCreds}`
        : nameWithFallback;

    // ---------- doctor branch ----------
    const branch: "SI" | "SL" = (actor.branch as "SI" | "SL") || "SI";
    const today = todayYMD();

    // 1) Try to find today's encounter for this patient at this branch
    const enc = await db
      .from("encounters")
      .select("id, consult_status, for_consult")
      .eq("patient_id", patientId)
      .eq("branch_code", branch)
      .eq("visit_date_local", today)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const encounterId = enc.data?.id ?? null;

    // 2) If there is already a consultation today, reuse it & attach encounter if missing
    const existing = await db
      .from("consultations")
      .select("id, encounter_id")
      .eq("patient_id", patientId)
      .gte("visit_at", `${today}T00:00:00+08:00`)
      .lte("visit_at", `${today}T23:59:59.999+08:00`)
      .order("visit_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.data?.id) {
      const upd = await db
        .from("consultations")
        .update({
          doctor_id: isUuid(doctor_id) ? doctor_id : null, // keep FK valid
          doctor_name_at_time: display || null,
          branch,
          encounter_id: existing.data.encounter_id || encounterId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id)
        .select("id")
        .maybeSingle();

      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });

      if (encounterId) {
        await db.from("encounters").update({ consult_status: "in_consult" }).eq("id", encounterId);
      }

      return NextResponse.json({ ok: true, consultation: { id: upd.data!.id } });
    }

    // === One FPE per calendar year ===
    const year = today.slice(0, 4);
    const startOfYear = `${year}-01-01T00:00:00+08:00`;
    const endOfYear = `${year}-12-31T23:59:59.999+08:00`;

    const fpeCheck = await db
      .from("consultations")
      .select("id")
      .eq("patient_id", patientId)
      .eq("type", "FPE")
      .gte("visit_at", startOfYear)
      .lte("visit_at", endOfYear)
      .neq("status", "cancelled")
      .limit(1);

    const computedType = fpeCheck.data && fpeCheck.data.length > 0 ? "FollowUp" : "FPE";

    // 3) Create a new consultation
    const ins = await db
      .from("consultations")
      .insert({
        patient_id: patientId,
        doctor_id: isUuid(doctor_id) ? doctor_id : null, // reliever → null
        doctor_name_at_time: display || null,
        branch,
        encounter_id: encounterId || null,
        visit_at: new Date().toISOString(),
        type: computedType, // <-- NEW
        status: "draft",
        plan_shared: null,
      })
      .select("id")
      .maybeSingle();

    if (ins.error || !ins.data?.id) {
      return NextResponse.json(
        { error: ins.error?.message || "Failed to create consultation" },
        { status: 400 },
      );
    }

    if (encounterId) {
      await db.from("encounters").update({ consult_status: "in_consult" }).eq("id", encounterId);
    }

    return NextResponse.json({ ok: true, consultation: { id: ins.data.id } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

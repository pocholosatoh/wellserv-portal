// app/api/doctor/consultations/finalize/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";
import { autoClearActiveFollowupIfQualified } from "@/lib/followups/autoClear";

function todayYMD(tz = process.env.APP_TZ || "Asia/Manila") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(req: Request) {
  const db = getSupabase();
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const consultation_id = String(body?.consultation_id || body?.consultationId || "").trim();
    const encounter_id = String(body?.encounter_id || body?.encounterId || "").trim();
    const skipFollowupAutoclear = Boolean(
      body?.skip_followup_autoclear ?? body?.skipFollowupAutoclear ?? false,
    );

    if (!consultation_id || !encounter_id) {
      return NextResponse.json(
        { error: "consultation_id and encounter_id are required." },
        { status: 400 },
      );
    }

    // 1) Block finalize if any prescription exists (draft OR signed)
    const { data: rxAny, error: rxErr } = await db
      .from("prescriptions")
      .select("id,status")
      .eq("consultation_id", consultation_id)
      .in("status", ["draft", "signed"])
      .limit(1);

    if (rxErr) {
      return NextResponse.json({ error: rxErr.message }, { status: 400 });
    }
    if (rxAny && rxAny.length > 0) {
      return NextResponse.json(
        {
          error:
            "A prescription already exists for this consultation. Sign it or delete the draft to finish.",
        },
        { status: 409 },
      );
    }

    // 2) Mark consultation as done (no Rx path)
    const up1 = await db
      .from("consultations")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", consultation_id)
      .select("encounter_id, patient_id, branch, type, visit_at")
      .maybeSingle();

    if (up1.error || !up1.data) {
      return NextResponse.json({ error: up1.error?.message || "Finalize failed" }, { status: 400 });
    }

    // 3) Update encounter consult_status only (do NOT change main lab status here)
    const candidateIds = new Set<string>();
    if (encounter_id) candidateIds.add(encounter_id);
    if (up1.data.encounter_id) candidateIds.add(up1.data.encounter_id);

    // Also grab encounters directly linked via current_consultation_id (covers legacy rows)
    const linked = await db
      .from("encounters")
      .select("id")
      .eq("current_consultation_id", consultation_id);
    (linked.data || []).forEach((r: any) => r?.id && candidateIds.add(r.id as string));

    // Fallback: today's queued/in-consult for same patient/branch
    if (up1.data.patient_id && up1.data.branch) {
      const today = todayYMD();
      const todays = await db
        .from("encounters")
        .select("id")
        .eq("patient_id", up1.data.patient_id)
        .eq("branch_code", up1.data.branch)
        .eq("visit_date_local", today)
        .in("consult_status", ["queued_for_consult", "in_consult", "in-progress"]);
      (todays.data || []).forEach((r: any) => r?.id && candidateIds.add(r.id as string));
    }

    if (candidateIds.size) {
      const ids = Array.from(candidateIds);
      const { data: encs, error: encErr } = await db
        .from("encounters")
        .select("id, status")
        .in("id", ids);
      if (encErr) return NextResponse.json({ error: encErr.message }, { status: 400 });

      const allowedToFinish = new Set(["for-processing", "for-extract", "done"]);
      const nowIso = new Date().toISOString();

      await Promise.all(
        (encs || []).map((enc) => {
          const payload: any = {
            consult_status: "done",
            current_consultation_id: null,
            updated_at: nowIso,
          };
          if (enc?.status && allowedToFinish.has(enc.status as string)) {
            payload.status = "done";
          }
          return db.from("encounters").update(payload).eq("id", enc.id);
        }),
      );
    }

    try {
      await autoClearActiveFollowupIfQualified({
        db,
        patientId: up1.data?.patient_id ?? null,
        closingConsultationId: consultation_id,
        consultVisitAt: up1.data?.visit_at ?? null,
        consultType: up1.data?.type ?? null,
        consultBranch: up1.data?.branch ?? null,
        skipFollowupAutoclear,
      });
    } catch {
      console.error("followup_autoclear_failed");
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

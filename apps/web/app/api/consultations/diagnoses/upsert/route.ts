export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor } from "@/lib/api-actor";

function isUuid(v?: string | null) {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export async function POST(req: Request) {
  try {
    const actor = await requireActor();
    if (!actor || actor.kind === "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Accept both old and new key names from client
    const consultation_id = String(body?.consultation_id || "").trim();
    const icd10_code = String(body?.icd10_code || body?.code || "")
      .trim()
      .toUpperCase();
    const icd10_text_snapshot = String(
      body?.icd10_text_snapshot || body?.title || body?.text || "",
    ).trim();
    const makePrimary = !!body?.make_primary;

    if (!consultation_id || !icd10_code || !icd10_text_snapshot) {
      return NextResponse.json(
        { error: "consultation_id, icd10_code, icd10_text_snapshot are required" },
        { status: 400 },
      );
    }

    const db = getSupabase();

    // 0) Load consultation; we need patient_id and encounter_id (NOT NULL in your schema)
    const c = await db
      .from("consultations")
      .select("id, patient_id, encounter_id")
      .eq("id", consultation_id)
      .maybeSingle();

    if (c.error) return NextResponse.json({ error: c.error.message }, { status: 400 });
    if (!c.data) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });

    let encounter_id = c.data.encounter_id ?? null;
    const patient_id = c.data.patient_id ?? null;

    if (!patient_id) {
      return NextResponse.json(
        { error: "Consultation has no patient_id. Please contact support." },
        { status: 400 },
      );
    }

    // If consultation has no encounter_id, try to attach the latest encounter of the patient.
    if (!encounter_id) {
      const enc = await db
        .from("encounters")
        .select("id")
        .eq("patient_id", patient_id)
        .order("visit_date_local", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!enc.data?.id) {
        return NextResponse.json(
          {
            error:
              "This consultation is not attached to an encounter. Start the consult from the queue/frontdesk encounter so it links correctly.",
          },
          { status: 400 },
        );
      }

      encounter_id = enc.data.id;

      // Persist the attachment for next time
      const updC = await db
        .from("consultations")
        .update({ encounter_id })
        .eq("id", consultation_id);

      if (updC.error) {
        return NextResponse.json({ error: updC.error.message }, { status: 400 });
      }
    }

    // 1) Validate ICD-10 code exists (optional but safer)
    const chk = await db.from("icd10").select("code").eq("code", icd10_code).maybeSingle();
    if (chk.error) return NextResponse.json({ error: chk.error.message }, { status: 400 });
    if (!chk.data) {
      return NextResponse.json({ error: "Unknown ICD-10 code" }, { status: 400 });
    }

    // 2) created_by must be NOT NULL in your schema
    const fallback = process.env.FALLBACK_DOCTOR_UUID || ZERO_UUID;
    const created_by =
      actor.kind === "doctor" && isUuid(actor.id) ? (actor.id as string) : fallback;

    // 3) Manual upsert (no onConflict → avoids schema-cache issues)
    const existing = await db
      .from("consultation_diagnoses")
      .select("id, is_primary")
      .eq("consultation_id", consultation_id)
      .eq("icd10_code", icd10_code)
      .maybeSingle();

    if (existing.error) {
      return NextResponse.json({ error: existing.error.message }, { status: 400 });
    }

    if (!existing.data) {
      const ins = await db
        .from("consultation_diagnoses")
        .insert({
          consultation_id,
          encounter_id,
          patient_id,
          icd10_code,
          icd10_text_snapshot,
          is_primary: false,
          created_by,
          // certainty, acuity, onset/resolved_date can be set later
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (ins.error) {
        return NextResponse.json({ error: ins.error.message }, { status: 400 });
      }
    } else {
      const upd = await db
        .from("consultation_diagnoses")
        .update({
          icd10_text_snapshot,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);

      if (upd.error) {
        return NextResponse.json({ error: upd.error.message }, { status: 400 });
      }
    }

    // 4) Make primary (clear others, set this one)
    if (makePrimary) {
      const clear = await db
        .from("consultation_diagnoses")
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq("consultation_id", consultation_id);

      if (clear.error) {
        return NextResponse.json({ error: clear.error.message }, { status: 400 });
      }

      const set = await db
        .from("consultation_diagnoses")
        .update({ is_primary: true, updated_at: new Date().toISOString() })
        .eq("consultation_id", consultation_id)
        .eq("icd10_code", icd10_code);

      if (set.error) {
        return NextResponse.json({ error: set.error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

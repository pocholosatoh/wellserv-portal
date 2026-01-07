import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { guard } from "@/lib/auth/guard";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY; // legacy env name fallback
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } });
}

const up = (s?: string) => (s || "").toUpperCase().trim();

function mmddyyyyToISO(s?: string): string | null {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function todayISOin(tz = process.env.APP_TZ || "Asia/Manila"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(req: Request) {
  const auth = await guard(req, { allow: ["staff"] });
  if (!auth.ok) return auth.response;
  const db = supa();
  try {
    const body = await req.json().catch(() => ({}));

    // Accept either patient{} block or flat fields (back-compat)
    const patient = body?.patient || {};
    const branch_code = up(body?.branch_code);
    const policy = String(body?.policy || "today-same-branch");

    const pid = up(patient?.patient_id || body?.patient_id);
    const name = up(patient?.full_name || body?.full_name);
    const sex = up(patient?.sex || body?.sex);
    const bdayISO = mmddyyyyToISO(patient?.birthday_mmddyyyy || body?.birthday_mmddyyyy);
    const contact = patient?.contact ?? body?.contact ?? null;
    const address = patient?.address ?? body?.address ?? null;

    if (!branch_code || !pid) {
      return NextResponse.json(
        { ok: false, error: "Missing branch_code or patient_id" },
        { status: 400 },
      );
    }

    // ── 1) Always try to upsert if we have minimally sufficient fields.
    //     This creates new patients and updates old ones in one shot.
    if (name && sex && bdayISO) {
      const { error: upErr } = await db.from("patients").upsert(
        {
          patient_id: pid,
          full_name: name,
          sex,
          birthday: bdayISO,
          contact,
          address,
        },
        { onConflict: "patient_id" },
      );
      if (upErr) {
        return NextResponse.json(
          { ok: false, stage: "patients_upsert", error: upErr.message },
          { status: 500 },
        );
      }
    } else {
      // If we didn't get enough fields to upsert, verify patient exists
      const { data: exists, error: selErr } = await db
        .from("patients")
        .select("patient_id")
        .eq("patient_id", pid)
        .maybeSingle();
      if (selErr) {
        return NextResponse.json(
          { ok: false, stage: "patients_select", error: selErr.message },
          { status: 500 },
        );
      }
      if (!exists) {
        // Not enough fields to create a brand-new row
        return NextResponse.json(
          {
            ok: false,
            error:
              "New patient needs full fields: patient{ patient_id, full_name, sex, birthday_mmddyyyy, contact?, address? }",
          },
          { status: 400 },
        );
      }
      // Else: existing patient; proceed (no changes)
    }

    // ── 2) Find or create today's encounter (one open encounter per patient/branch/day)
    const today = todayISOin();
    let encounter_id: string | null = null;

    if (policy === "today-same-branch") {
      const { data: found, error: findErr } = await db
        .from("encounters")
        .select("id")
        .eq("branch_code", branch_code)
        .eq("patient_id", pid)
        .eq("visit_date_local", today)
        .in("status", ["intake", "for-extract", "extracted", "for-processing"])
        .maybeSingle();
      if (findErr) {
        return NextResponse.json(
          { ok: false, stage: "encounters_lookup", error: findErr.message },
          { status: 500 },
        );
      }
      if (found?.id) encounter_id = found.id;
    }

    if (!encounter_id) {
      const { data: ins, error: insErr } = await db
        .from("encounters")
        .insert([
          {
            branch_code,
            patient_id: pid,
            visit_date_local: today,
            status: "intake",
            yakap_flag: !!body?.yakap_flag,
            is_philhealth_claim: !!body?.yakap_flag,
            notes_frontdesk: body?.requested_tests_csv || null,
            claim_notes: null,
          },
        ])
        .select("id")
        .single();

      if (insErr) {
        const fkHint = /foreign key/i.test(insErr.message || "")
          ? "Likely cause: patient row missing due to RLS or wrong API key. Ensure SUPABASE_SERVICE_ROLE is used."
          : undefined;
        return NextResponse.json(
          { ok: false, stage: "encounters_insert", error: insErr.message, hint: fkHint },
          { status: 500 },
        );
      }
      encounter_id = ins?.id || null;
    }

    if (!encounter_id) {
      return NextResponse.json(
        { ok: false, stage: "encounters_none", error: "No encounter_id produced" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, encounter_id });
  } catch (err: any) {
    console.error("[create-or-get] fatal", err);
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 });
  }
}

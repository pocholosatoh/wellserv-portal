// app/api/staff/encounters/create-or-get/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function mmddyyyyToISO(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || "").trim());
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  return `${yyyy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
}

export async function POST(req: Request) {
  const db = supa();
  try {
    const body = await req.json();
    const branch_code = String(body?.branch_code || "").toUpperCase();
    const patient_id = String(body?.patient_id || "");
    const birthdayISO = mmddyyyyToISO(String(body?.birthday_mmddyyyy || ""));
    const policy = String(body?.policy || "today-same-branch");

    if (!branch_code || !patient_id) {
      return NextResponse.json({ ok: false, error: "Missing branch_code or patient_id" }, { status: 400 });
    }

    // Check for an open encounter for today (policy: one encounter per day per branch)
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: process.env.APP_TZ || "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    let encounter_id: string | null = null;

    // Try to find an existing one for policy "today-same-branch"
    if (policy === "today-same-branch") {
      const { data: found, error: findErr } = await db
        .from("encounters")
        .select("id")
        .eq("branch_code", branch_code)
        .eq("patient_id", patient_id)
        .eq("visit_date_local", today)
        .limit(1)
        .maybeSingle();

      if (findErr) {
        console.error("[create-or-get] find error", findErr);
      }
      if (found?.id) encounter_id = found.id;
    }

    // Create if none
    if (!encounter_id) {
      const { data: ins, error: insErr } = await db
        .from("encounters")
        .insert({
          branch_code,
          patient_id,
          visit_date_local: today,
          yakap_flag: false,
          // add minimal columns; others can be updated later in your existing flow
        })
        .select("id")
        .single();

      if (insErr) {
        console.error("[create-or-get] insert error", insErr);
        return NextResponse.json({ ok: false, error: "Failed to create encounter" }, { status: 500 });
      }
      encounter_id = ins?.id || null;
    }

    if (!encounter_id) {
      return NextResponse.json({ ok: false, error: "No encounter_id produced" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, encounter_id });
  } catch (err: any) {
    console.error("[create-or-get] fatal", err);
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 });
  }
}

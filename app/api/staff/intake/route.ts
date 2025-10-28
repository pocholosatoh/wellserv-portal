// app/api/staff/intake/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appendRunningRow } from "@/lib/sheetsdaily";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const up = (s?: string) => (s || "").toUpperCase().trim();

function mmddyyyyToISO(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || "").trim());
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
  const db = supa();

  try {
    const body = await req.json().catch(() => ({}));
    const {
      branch_code, // "SI" | "SL"
      patient,     // { patient_id, full_name, sex, birthday_mmddyyyy, contact, address }
      requested_tests_csv,
      yakap_flag = false,
      price_manual_add = 0,
      queue_now = false,
      encounter_id: encounterIdFromClient, // NEW
      source = "frontdesk",
    } = body || {};

    // ----------------- GUARDRAILS (Hard validation) -----------------
    if (!branch_code || !["SI", "SL"].includes(branch_code)) {
      return NextResponse.json({ ok: false, error: "Branch required (SI or SL)." }, { status: 400 });
    }
    if (!patient?.patient_id || !patient?.full_name || !patient?.sex || !patient?.birthday_mmddyyyy) {
      return NextResponse.json({ ok: false, error: "Missing required patient fields." }, { status: 400 });
    }
    const isoBirthday = mmddyyyyToISO(patient.birthday_mmddyyyy);
    if (!isoBirthday) {
      return NextResponse.json({ ok: false, error: "Birthday must be MM/DD/YYYY." }, { status: 400 });
    }

    // ----------------- 1) Upsert patient -----------------
    const pid = up(patient.patient_id);
    const { error: upErr } = await db
      .from("patients")
      .upsert(
        {
          patient_id: pid,
          full_name: up(patient.full_name),
          sex: up(patient.sex),
          birthday: isoBirthday,
          contact: patient.contact || null,
          address: patient.address || null,
        },
        { onConflict: "patient_id" }
      );
    if (upErr) throw upErr;

    // ----------------- 2) Find/create today's encounter -----------------
    // Prefer client-provided encounter_id (from Reception Save pre-step). If absent, do your normal find/create.
    let encounter_id: string | null = body?.encounter_id || null; // NEW: encounter_id from client

    const visit_date_local = todayISOin();

    if (!encounter_id) {
      // No encounter passed by the client → keep your existing policy (one encounter per patient/branch/day in open statuses)
      const { data: existing } = await db
        .from("encounters")
        .select("id,status")
        .eq("patient_id", pid)
        .eq("branch_code", branch_code)
        .eq("visit_date_local", visit_date_local)
        .in("status", ["intake", "for-extract", "extracted", "for-processing"])
        .maybeSingle();

      if (!existing?.id) {
        const { data: ins, error: insErr } = await db
          .from("encounters")
          .insert([
            {
              patient_id: pid,
              branch_code,
              visit_date_local,
              status: "intake",
              is_philhealth_claim: !!yakap_flag,
              yakap_flag: !!yakap_flag,
              claim_notes: null,
              notes_frontdesk: requested_tests_csv || null,
            },
          ])
          .select("id")
          .single();
        if (insErr) throw insErr;
        encounter_id = ins.id;
      } else {
        encounter_id = existing.id;
        if (requested_tests_csv || yakap_flag) {
          await db
            .from("encounters")
            .update({
              notes_frontdesk: requested_tests_csv || null,
              yakap_flag: !!yakap_flag,
              is_philhealth_claim: !!yakap_flag,
            })
            .eq("id", encounter_id);
        }
      }
    }

    // If still no encounter_id, fail early (prevents Sheet append without ID)
    if (!encounter_id) {
      return NextResponse.json(
        { ok: false, error: "Could not create encounter; please retry." },
        { status: 500 }
      );
    }
    // ----------------- /end encounter block -----------------


    // ----------------- 3) Expand requested tokens -----------------
    const tokens: string[] = (requested_tests_csv || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    let expanded = [...tokens];

    if (tokens.length) {
      // try direct package codes
      const { data: items1 } = await db
        .from("package_items")
        .select("package_code,test_code")
        .in("package_code", tokens);

      let items = items1 || [];

      // fallback: map display_name -> package_code
      if (items.length === 0) {
        const { data: packsByName } = await db
          .from("packages")
          .select("package_code,display_name")
          .in("display_name", tokens);

        const codes = (packsByName || []).map((p) => p.package_code);
        if (codes.length) {
          const { data: items2 } = await db
            .from("package_items")
            .select("package_code,test_code")
            .in("package_code", codes);
          items = items2 || [];
        }
      }

      if (items.length) {
        const byPack = new Map<string, string[]>();
        for (const r of items) {
          const k = String((r as any).package_code || "").toUpperCase();
          const arr = byPack.get(k) || [];
          if ((r as any).test_code) arr.push(String((r as any).test_code));
          byPack.set(k, arr);
        }
        expanded = tokens.flatMap((t: string) => byPack.get(t.toUpperCase()) ?? [t]);
      }
    }

    // ----------------- 4) Server-side pricing -----------------
    const [{ data: tests }, { data: packs }] = await Promise.all([
      db.from("tests_catalog").select("test_code,default_price,is_active").eq("is_active", true),
      db.from("packages").select("package_code,package_price"),
    ]);

    const testPrice = new Map<string, number>();
    (tests || []).forEach((t) => testPrice.set(String(t.test_code).toUpperCase(), Number(t.default_price || 0)));

    const packPrice = new Map<string, number>();
    (packs || []).forEach((p) => packPrice.set(String(p.package_code).toUpperCase(), Number(p.package_price || 0)));

    // package members
    const { data: allItems } = await db.from("package_items").select("package_code,test_code");
    const packMembers: Record<string, Set<string>> = {};
    (allItems || []).forEach((it) => {
      const p = String(it.package_code).toUpperCase();
      const tc = String(it.test_code).toUpperCase();
      if (!packMembers[p]) packMembers[p] = new Set();
      packMembers[p].add(tc);
    });

    // compute
    const tokenSet = new Set(expanded.map((t) => t.toUpperCase()));
    const originalTokenSet = new Set(tokens.map((t) => t.toUpperCase()));
    let autoTotal = 0;

    // add package prices + remove covered members
    for (const tok of originalTokenSet) {
      if (packPrice.has(tok)) {
        autoTotal += packPrice.get(tok)!;
        const members = packMembers[tok];
        if (members) for (const m of members) tokenSet.delete(m);
      }
    }
    // add remaining tests
    for (const tok of tokenSet) {
      if (testPrice.has(tok)) autoTotal += testPrice.get(tok)!;
    }

    const manualAdd = Math.max(0, Number(price_manual_add || 0));
    const finalTotal = autoTotal + manualAdd;

    // save a single order_items row (compact)
    if (expanded.length) {
      await db
        .from("order_items")
        .insert([{ encounter_id, kind: "manual", code_or_name: expanded.join(", "), qty: 1, source }])
        .select("id")
        .maybeSingle();
    }

    // persist pricing on encounter
    await db.from("encounters").update({
      price_auto_total: autoTotal,
      price_manual_add: manualAdd,
      total_price: finalTotal,
    }).eq("id", encounter_id);

    // optional queue step
    if (queue_now) {
      const { data: enc } = await db.from("encounters").select("status").eq("id", encounter_id).single();
      if (enc?.status === "intake") {
        await db.from("encounters").update({ status: "for-extract" }).eq("id", encounter_id);
      }
    }

    // ----------------- 5) Append to Running Sheet -----------------
    let sheet_status: "ok" | "skipped" | "failed" = "skipped";
    let sheet_reason: string | null = null;
    let sheet_error: string | null = null;
    // NEW: collect telemetry to return + log
    let sheet_debug: any = null;

    try {
      const hasEndpoint = !!process.env.APPS_SCRIPT_ENDPOINT;
      const hasToken = !!process.env.APPS_SCRIPT_TOKEN;
      const branchSheetId =
        (branch_code === "SI" ? process.env.SI_RUNNING_SHEET_ID : process.env.SL_RUNNING_SHEET_ID) || "";

      if (hasEndpoint && hasToken && branchSheetId) {
        const encId = String(encounter_id);

        // Log what we are about to send
        console.log("[intake] appendRunningRow payload:", {
          branch_code,
          row: {
            encounter_id: encId,
            patient_id: pid,
            full_name: up(patient.full_name),
            sex: up(patient.sex),
            birthday: patient.birthday_mmddyyyy,
            contact: patient.contact || "",
            address: patient.address || "",
            notes: requested_tests_csv || "",
          }
        });

        // Call the helper and capture the Script’s JSON
        const resp = await appendRunningRow(branch_code, {
          encounter_id: encId,
          patient_id: pid,
          full_name: up(patient.full_name),
          age: "", // computed by sheet
          sex: up(patient.sex) as "M" | "F",
          birthday: patient.birthday_mmddyyyy,
          contact: patient.contact || "",
          address: patient.address || "",
          notes: requested_tests_csv || "",
        });

        sheet_debug = resp; // keep the raw script response
        console.log("[intake] Sheets append response:", resp);

        sheet_status = "ok";
      } else {
        sheet_status = "skipped";
        sheet_reason =
          "Missing APPS_SCRIPT_ENDPOINT/APPS_SCRIPT_TOKEN or branch sheet id (SI_RUNNING_SHEET_ID / SL_RUNNING_SHEET_ID).";
        console.warn("[intake] Sheets append skipped:", sheet_reason);
      }
    } catch (e: any) {
      sheet_status = "failed";
      sheet_error = e?.message || String(e);
      console.error("[intake] Sheets append failed:", sheet_error);
    }

    // If you want to HARD-FAIL when append fails, set env REQUIRE_SHEETS_APPEND=true
    if (process.env.REQUIRE_SHEETS_APPEND === "true" && sheet_status !== "ok") {
      return NextResponse.json(
        {
          ok: false,
          error:
            sheet_status === "failed"
              ? `Sheets append failed: ${sheet_error || "unknown"}`
              : `Sheets append skipped: ${sheet_reason || "not configured"}`,
          sheet_status,
          sheet_reason,
          sheet_error,
        },
        { status: 500 }
      );
    }

    // ----------------- Success response (with sheet telemetry) -----------------
    return NextResponse.json({
      ok: true,
      encounter_id,
      totals: { auto: autoTotal, manual: manualAdd, final: finalTotal },
      sheet_status,
      sheet_reason,
      sheet_error,
      sheet_debug, 
    });
  } catch (err: any) {
    console.error("[intake] Fatal error:", err);
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

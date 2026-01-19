// app/api/staff/intake/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appendRunningRow } from "@/lib/sheetsdaily";
import {
  buildLabCatalogIndex,
  normalizeCode,
  normalizeIdList,
} from "@/lib/labSelection";
import { guard } from "@/lib/auth/guard";
import { mergeFrontdeskNotes, normalizeManualNotes } from "@/lib/notesFrontdesk";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ require service role on server
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE (server)");
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

const DISCOUNT_RATE = 0.2;

export async function POST(req: Request) {
  const auth = await guard(req, { allow: ["staff"] });
  if (!auth.ok) return auth.response;
  const db = supa();

  try {
    const body = await req.json().catch(() => ({}));
    const {
      branch_code, // "SI" | "SL"
      patient, // { patient_id, full_name, sex, birthday_mmddyyyy, contact, address }
      requested_tests_csv,
      notes_frontdesk_manual,
      yakap_flag = false,
      price_manual_add = 0,
      discount_enabled,
      queue_now = false,
      encounter_id: encounterIdFromClient, // NEW
      source = "frontdesk",
    } = body || {};

    const discountEnabled = typeof discount_enabled === "boolean" ? discount_enabled : false;

    // ----------------- GUARDRAILS (Hard validation) -----------------
    if (!branch_code || !["SI", "SL"].includes(branch_code)) {
      return NextResponse.json(
        { ok: false, error: "Branch required (SI or SL)." },
        { status: 400 },
      );
    }
    if (
      !patient?.patient_id ||
      !patient?.full_name ||
      !patient?.sex ||
      !patient?.birthday_mmddyyyy
    ) {
      return NextResponse.json(
        { ok: false, error: "Missing required patient fields." },
        { status: 400 },
      );
    }
    const isoBirthday = mmddyyyyToISO(patient.birthday_mmddyyyy);
    if (!isoBirthday) {
      return NextResponse.json(
        { ok: false, error: "Birthday must be MM/DD/YYYY." },
        { status: 400 },
      );
    }

    // ----------------- 1) Upsert patient -----------------
    const pid = up(patient.patient_id);
    const { error: upErr } = await db.from("patients").upsert(
      {
        patient_id: pid,
        full_name: up(patient.full_name),
        sex: up(patient.sex),
        birthday: isoBirthday,
        contact: patient.contact || null,
        address: patient.address || null,
      },
      { onConflict: "patient_id" },
    );

    if (upErr) {
      // Bubble a very clear message (RLS / key mismatch shows up here)
      return NextResponse.json(
        { ok: false, stage: "patients_upsert", error: upErr.message },
        { status: 500 },
      );
    }

    // ✅ Double-check the row actually exists (guards against RLS)
    const { data: pRow, error: selErr } = await db
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
    if (!pRow) {
      return NextResponse.json(
        {
          ok: false,
          stage: "patients_verify",
          error:
            "Patient insert did not persist. Check RLS and ensure the server uses SUPABASE_SERVICE_ROLE.",
          hint: "Existing patients work because no insert is needed; new ones require insert allowed by the service-role key.",
        },
        { status: 500 },
      );
    }

    // ----------------- 2) Resolve selection (id-first, ids authoritative) -----------------
    const requestedTestsCsvInput =
      typeof requested_tests_csv === "string" ? requested_tests_csv : "";
    const inputTokens = requestedTestsCsvInput
      .split(",")
      .map((s: string) => normalizeCode(s))
      .filter(Boolean);
    const inputTokenSet = new Set(inputTokens);

    const requestedPackageIds = normalizeIdList(body?.package_ids || body?.requested_package_ids);
    const requestedTestIds = normalizeIdList(body?.test_ids || body?.requested_test_ids);

    const [{ data: testsRaw }, { data: packs }] = await Promise.all([
      db.from("tests_catalog").select("id,test_code,default_price,is_active"),
      db.from("packages").select("id,package_code,display_name,package_price"),
    ]);

    const activeTests = (testsRaw || []).filter((t) => t.is_active);

    console.info("[intake] catalog loaded", {
      tests: testsRaw?.length || 0,
      active_tests: activeTests.length,
      packages: packs?.length || 0,
    });

    const baseIndex = buildLabCatalogIndex(activeTests || [], packs || [], []);

    const missingPackageIds = requestedPackageIds.filter((id) => !baseIndex.packageById.has(id));
    if (missingPackageIds.length) {
      console.warn("[intake] package_id not found", { missingPackageIds });
      return NextResponse.json(
        { ok: false, error: "package_id not found", missing_package_ids: missingPackageIds },
        { status: 404 },
      );
    }

    const missingTestIds = requestedTestIds.filter((id) => !baseIndex.testById.has(id));
    if (missingTestIds.length) {
      console.warn("[intake] test_id not found", { missingTestIds });
      return NextResponse.json(
        { ok: false, error: "test_id not found", missing_test_ids: missingTestIds },
        { status: 404 },
      );
    }

    const canonicalCodes: string[] = [];
    const canonicalCodeSet = new Set<string>();
    const pushCanonical = (code?: string | null) => {
      const normalized = normalizeCode(code);
      if (!normalized || canonicalCodeSet.has(normalized)) return;
      canonicalCodeSet.add(normalized);
      canonicalCodes.push(normalized);
    };

    for (const pkgId of requestedPackageIds) {
      pushCanonical(baseIndex.packageCodeById.get(pkgId));
    }
    for (const testId of requestedTestIds) {
      pushCanonical(baseIndex.testCodeById.get(testId));
    }

    const canonicalRequestedTestsCsv = canonicalCodes.join(", ");
    const canonicalTokenSet = new Set(canonicalCodes);
    const csvProvided = requestedTestsCsvInput.trim().length > 0;

    if (csvProvided) {
      const extraInputCount = Array.from(inputTokenSet).filter(
        (code) => !canonicalTokenSet.has(code),
      ).length;
      const missingInputCount = Array.from(canonicalTokenSet).filter(
        (code) => !inputTokenSet.has(code),
      ).length;

      if (extraInputCount || missingInputCount) {
        console.warn("[intake] requested_tests_csv mismatch (using ids)", {
          branch_code,
          patient_id: pid,
          input_count: inputTokenSet.size,
          canonical_count: canonicalTokenSet.size,
          extra_input_count: extraInputCount,
          missing_input_count: missingInputCount,
        });
      }
    }

    const manualNotes = normalizeManualNotes(notes_frontdesk_manual);
    const notesFrontdeskManual = manualNotes || null;
    const canonicalNotesFrontdesk = canonicalRequestedTestsCsv || null;
    const finalNotesFrontdesk = mergeFrontdeskNotes(canonicalNotesFrontdesk, manualNotes);

    const selectedPackageIds = requestedPackageIds;
    const selectedTestIds = requestedTestIds;
    const shouldUpdateNotes =
      csvProvided ||
      selectedPackageIds.length > 0 ||
      selectedTestIds.length > 0 ||
      !!manualNotes;

    // ----------------- 3) Find/create today's encounter -----------------
    const visit_date_local = todayISOin();
    let encounter_id: string | null = body?.encounter_id || null;

    if (!encounter_id) {
      const { data: existing, error: exErr } = await db
        .from("encounters")
        .select("id,status")
        .eq("patient_id", pid)
        .eq("branch_code", branch_code)
        .eq("visit_date_local", visit_date_local)
        .in("status", ["intake", "for-extract", "extracted", "for-processing"])
        .maybeSingle();

      if (exErr) {
        return NextResponse.json(
          { ok: false, stage: "encounters_lookup", error: exErr.message },
          { status: 500 },
        );
      }

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
              notes_frontdesk: canonicalNotesFrontdesk,
              notes_frontdesk_manual: notesFrontdeskManual,
            },
          ])
          .select("id")
          .single();

        if (insErr) {
          // Helpful foreign-key hint for new patients
          const fkHint = /foreign key/i.test(insErr.message || "")
            ? "Likely cause: patient row missing due to RLS or wrong API key (anon). Ensure SUPABASE_SERVICE_ROLE is set on the server."
            : undefined;
          return NextResponse.json(
            { ok: false, stage: "encounters_insert", error: insErr.message, hint: fkHint },
            { status: 500 },
          );
        }
        encounter_id = ins.id;
      } else {
        encounter_id = existing.id;
        if (shouldUpdateNotes || yakap_flag) {
          const { error: updErr } = await db
            .from("encounters")
            .update({
              notes_frontdesk: canonicalNotesFrontdesk,
              notes_frontdesk_manual: notesFrontdeskManual,
              yakap_flag: !!yakap_flag,
              is_philhealth_claim: !!yakap_flag,
            })
            .eq("id", encounter_id);
          if (updErr) {
            return NextResponse.json(
              { ok: false, stage: "encounters_update", error: updErr.message },
              { status: 500 },
            );
          }
        }
      }
    }

    if (!encounter_id) {
      return NextResponse.json(
        { ok: false, stage: "encounters_none", error: "Could not create encounter; please retry." },
        { status: 500 },
      );
    }

    const { data: itemsRaw } =
      selectedPackageIds.length > 0
        ? await db
            .from("package_items")
            .select("package_id,test_id")
            .in("package_id", selectedPackageIds)
        : { data: [] };

    const index = buildLabCatalogIndex(activeTests || [], packs || [], itemsRaw || []);

    console.info("[intake] lab selection", {
      packages: selectedPackageIds.length,
      tests: selectedTestIds.length,
      source: "ids",
    });

    const expanded: string[] = [];
    const expandedSet = new Set<string>();
    const pushExpanded = (code?: string | null) => {
      const normalized = normalizeCode(code);
      if (!normalized || expandedSet.has(normalized)) return;
      expandedSet.add(normalized);
      expanded.push(normalized);
    };

    for (const pkgId of selectedPackageIds) {
      const members = index.packageItemsByPackageId.get(pkgId) || [];
      for (const testId of members) {
        pushExpanded(index.testCodeById.get(testId));
      }
    }
    for (const testId of selectedTestIds) {
      pushExpanded(index.testCodeById.get(testId));
    }

    console.info("[intake] package expansion", {
      packages: selectedPackageIds.length,
      expanded_tokens: expanded.length,
    });

    // ----------------- 4) Server-side pricing (id-based) -----------------
    const testPriceById = new Map<string, number>();
    (activeTests || []).forEach((t) =>
      testPriceById.set(String(t.id), Number(t.default_price || 0)),
    );

    const packPriceById = new Map<string, number>();
    (packs || []).forEach((p) =>
      packPriceById.set(String(p.id), Number(p.package_price || 0)),
    );

    const packageMemberSet = new Set<string>();
    let packageTotal = 0;
    for (const pkgId of new Set(selectedPackageIds)) {
      if (packPriceById.has(pkgId)) packageTotal += packPriceById.get(pkgId)!;
      const members = index.packageItemsByPackageId.get(pkgId) || [];
      for (const m of members) packageMemberSet.add(m);
    }

    const nonPackageTestIds = new Set<string>();
    for (const testId of new Set(selectedTestIds)) {
      if (packageMemberSet.has(testId)) continue;
      if (testPriceById.has(testId)) nonPackageTestIds.add(testId);
    }

    let nonPackageTestsTotal = 0;
    for (const testId of nonPackageTestIds) {
      nonPackageTestsTotal += testPriceById.get(testId)!;
    }

    const manualRaw = Number(price_manual_add || 0);
    const manualAdd = Math.max(0, Number.isFinite(manualRaw) ? manualRaw : 0);
    const discountBase = nonPackageTestsTotal + manualAdd;
    const discountAmount = discountEnabled ? Math.round(discountBase * DISCOUNT_RATE) : 0;

    const grossTotal = packageTotal + nonPackageTestsTotal + manualAdd;
    const autoTotal = Math.round(packageTotal + nonPackageTestsTotal);
    const manualRounded = Math.round(manualAdd);
    const finalTotal = Math.round(grossTotal - discountAmount);

    console.info("[intake] pricing computed", {
      source: "ids",
      package_total: packageTotal,
      non_package_tests_total: nonPackageTestsTotal,
      final_total: finalTotal,
    });

    // save a single order_items row (compact)
    if (expanded.length) {
      await db
        .from("order_items")
        .insert([
          { encounter_id, kind: "manual", code_or_name: expanded.join(", "), qty: 1, source },
        ])
        .select("id")
        .maybeSingle();
    }

    // persist pricing on encounter
    const encounterPatch = {
      price_auto_total: autoTotal,
      price_manual_add: manualRounded,
      discount_enabled: discountEnabled,
      discount_rate: DISCOUNT_RATE,
      discount_amount: discountAmount,
      total_price: finalTotal,
      ...(shouldUpdateNotes
        ? {
            notes_frontdesk: canonicalNotesFrontdesk,
            notes_frontdesk_manual: notesFrontdeskManual,
          }
        : {}),
    };

    await db.from("encounters").update(encounterPatch).eq("id", encounter_id);

    // optional queue step
    if (queue_now) {
      const { data: enc } = await db
        .from("encounters")
        .select("status")
        .eq("id", encounter_id)
        .single();
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
        (branch_code === "SI"
          ? process.env.SI_RUNNING_SHEET_ID
          : process.env.SL_RUNNING_SHEET_ID) || "";

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
            notes: finalNotesFrontdesk || "",
          },
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
          notes: finalNotesFrontdesk || "",
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
        { status: 500 },
      );
    }

    // ----------------- Success response (with sheet telemetry) -----------------
    return NextResponse.json({
      ok: true,
      encounter_id,
      totals: { auto: autoTotal, manual: manualRounded, final: finalTotal },
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

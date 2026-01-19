import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  buildLabCatalogIndex,
  expandTokensByPackageIds,
  findIdCodeMismatch,
  normalizeIdList,
  resolveTokens,
} from "@/lib/labSelection";
import { normalizeManualNotes } from "@/lib/notesFrontdesk";
import { guard } from "@/lib/auth/guard";

const DISCOUNT_RATE = 0.2;

export async function POST(req: Request) {
  const auth = await guard(req, { allow: ["staff"] });
  if (!auth.ok) return auth.response;
  const db = getSupabase();
  try {
    const body = await req.json().catch(() => ({}));

    // NEW: accept Yakap/Claim flags (optional)
    const {
      id,
      requested_tests_csv,
      notes_frontdesk_manual,
      price_manual_add = 0,
      discount_enabled,
      yakap_flag, // boolean | undefined
      is_philhealth_claim, // boolean | undefined
    } = body || {};

    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    // Expand packages -> tests (id-first)
    const requestedCsvInput = typeof requested_tests_csv === "string" ? requested_tests_csv : "";
    const tokens: string[] = requestedCsvInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const manualNotes = normalizeManualNotes(notes_frontdesk_manual);
    const notesFrontdeskManual = manualNotes || null;
    const canonicalNotesFrontdesk = requestedCsvInput.trim();
    const notesFrontdesk = canonicalNotesFrontdesk || null;

    const requestedPackageIds = normalizeIdList(body?.package_ids || body?.requested_package_ids);
    const requestedTestIds = normalizeIdList(body?.test_ids || body?.requested_test_ids);

    const [{ data: testsRaw }, { data: packs }] = await Promise.all([
      db.from("tests_catalog").select("id,test_code,default_price,is_active"),
      db.from("packages").select("id,package_code,display_name,package_price"),
    ]);

    const activeTests = (testsRaw || []).filter((t) => t.is_active);

    console.info("[encounters/edit] catalog loaded", {
      tests: testsRaw?.length || 0,
      active_tests: activeTests.length,
      packages: packs?.length || 0,
    });

    const baseIndex = buildLabCatalogIndex(testsRaw || [], packs || [], []);

    const missingPackageIds = requestedPackageIds.filter((pid) => !baseIndex.packageById.has(pid));
    if (missingPackageIds.length) {
      console.warn("[encounters/edit] package_id not found", { missingPackageIds });
      return NextResponse.json(
        { error: "package_id not found", missing_package_ids: missingPackageIds },
        { status: 404 },
      );
    }

    const missingTestIds = requestedTestIds.filter((tid) => !baseIndex.testById.has(tid));
    if (missingTestIds.length) {
      console.warn("[encounters/edit] test_id not found", { missingTestIds });
      return NextResponse.json(
        { error: "test_id not found", missing_test_ids: missingTestIds },
        { status: 404 },
      );
    }

    const tokenResolution = resolveTokens(tokens, baseIndex, { allowNameFallback: true });
    if (tokenResolution.errors.length) {
      return NextResponse.json({ error: tokenResolution.errors[0] }, { status: 400 });
    }

    const mismatch = findIdCodeMismatch(tokens, requestedPackageIds, requestedTestIds, baseIndex);
    if (mismatch) {
      console.warn("[encounters/edit] id/code mismatch", mismatch);
      return NextResponse.json(
        {
          error:
            mismatch.kind === "package"
              ? "package_id does not match package_code in requested_tests_csv"
              : "test_id does not match test_code in requested_tests_csv",
          details: mismatch,
        },
        { status: 400 },
      );
    }

    const selectedPackageIds = requestedPackageIds.length
      ? requestedPackageIds
      : tokenResolution.packageIds;
    const selectedTestIds = requestedTestIds.length ? requestedTestIds : tokenResolution.testIds;

    const { data: itemsRaw } =
      selectedPackageIds.length > 0
        ? await db
            .from("package_items")
            .select("package_id,test_id")
            .in("package_id", selectedPackageIds)
        : { data: [] };

    const index = buildLabCatalogIndex(testsRaw || [], packs || [], itemsRaw || []);

    console.info("[encounters/edit] lab selection", {
      tokens: tokens.length,
      packages: selectedPackageIds.length,
      tests: selectedTestIds.length,
      source: requestedPackageIds.length || requestedTestIds.length ? "ids" : "codes",
    });

    let expanded = expandTokensByPackageIds(tokenResolution.matches, index);
    if (!expanded.length && (selectedPackageIds.length || selectedTestIds.length)) {
      const derived: string[] = [];
      for (const pkgId of selectedPackageIds) {
        const members = index.packageItemsByPackageId.get(pkgId) || [];
        for (const testId of members) {
          const code = index.testCodeById.get(testId);
          if (code) derived.push(code);
        }
      }
      for (const testId of selectedTestIds) {
        const code = index.testCodeById.get(testId);
        if (code) derived.push(code);
      }
      expanded = derived;
    }

    console.info("[encounters/edit] package expansion", {
      packages: selectedPackageIds.length,
      expanded_tokens: expanded.length,
    });

    // Pricing (id-based)
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

    let discountEnabled: boolean | null =
      typeof discount_enabled === "boolean" ? discount_enabled : null;
    if (discountEnabled === null) {
      const { data: encRow, error: encErr } = await db
        .from("encounters")
        .select("discount_enabled")
        .eq("id", id)
        .maybeSingle();
      if (encErr) throw encErr;
      discountEnabled = !!encRow?.discount_enabled;
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
    const manual = Math.max(0, Number.isFinite(manualRaw) ? manualRaw : 0);
    const discountBase = nonPackageTestsTotal + manual;
    const discountAmount = discountEnabled ? Math.round(discountBase * DISCOUNT_RATE) : 0;

    const grossTotal = packageTotal + nonPackageTestsTotal + manual;
    const autoTotal = Math.round(packageTotal + nonPackageTestsTotal);
    const manualRounded = Math.round(manual);
    const final = Math.round(grossTotal - discountAmount);

    console.info("[encounters/edit] pricing computed", {
      source: requestedPackageIds.length || requestedTestIds.length ? "ids" : "codes",
      package_total: packageTotal,
      non_package_tests_total: nonPackageTestsTotal,
      final_total: final,
    });

    // Build the patch object safely (only include provided fields)
    const patch: any = {
      notes_frontdesk: notesFrontdesk,
      notes_frontdesk_manual: notesFrontdeskManual,
      price_manual_add: manualRounded,
      price_auto_total: autoTotal,
      discount_enabled: discountEnabled,
      discount_rate: DISCOUNT_RATE,
      discount_amount: discountAmount,
      total_price: final,
    };
    if (typeof yakap_flag === "boolean") patch.yakap_flag = yakap_flag;
    if (typeof is_philhealth_claim === "boolean") patch.is_philhealth_claim = is_philhealth_claim;

    // Update encounter
    const { error: upErr } = await db.from("encounters").update(patch).eq("id", id);
    if (upErr) throw upErr;

    // Replace manual order_items
    const { error: delErr } = await db
      .from("order_items")
      .delete()
      .match({ encounter_id: id, kind: "manual" });
    if (delErr) throw delErr;

    if (expanded.length) {
      const { error: insErr } = await db.from("order_items").insert([
        {
          encounter_id: id,
          kind: "manual",
          code_or_name: expanded.join(", "),
          qty: 1,
          source: "admin-edit",
        },
      ]);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ok: true, totals: { auto: autoTotal, manual: manualRounded, final } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

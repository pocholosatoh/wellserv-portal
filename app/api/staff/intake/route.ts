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
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
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
      yakap_flag = false,        // single flag as requested
      price_manual_add = 0,      // number
      queue_now = false,
      source = "frontdesk",
    } = body || {};

    if (!branch_code || !patient?.patient_id || !patient?.full_name || !patient?.sex || !patient?.birthday_mmddyyyy) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }

    // 1) Upsert patient
    const pid = up(patient.patient_id);
    const isoBirthday = mmddyyyyToISO(patient.birthday_mmddyyyy);
    const { error: upErr } = await db
      .from("patients")
      .upsert({
        patient_id: pid,
        full_name: up(patient.full_name),
        sex: up(patient.sex),
        birthday: isoBirthday,
        contact: patient.contact || null,
        address: patient.address || null,
      }, { onConflict: "patient_id" });
    if (upErr) throw upErr;

    // 2) Find/create today's encounter (per branch)
    const visit_date_local = todayISOin();
    const { data: existing } = await db
      .from("encounters")
      .select("id,status")
      .eq("patient_id", pid)
      .eq("branch_code", branch_code)
      .eq("visit_date_local", visit_date_local)
      .in("status", ["intake","for-extract","extracted","for-processing"])
      .maybeSingle();

    let encounter_id: string;
    if (!existing?.id) {
      const { data: ins, error: insErr } = await db
        .from("encounters")
        .insert([{
          patient_id: pid,
          branch_code,
          visit_date_local,
          status: "intake",
          is_philhealth_claim: !!yakap_flag, // you wanted YAKAP imply PhilHealth
          yakap_flag: !!yakap_flag,
          claim_notes: null,
          notes_frontdesk: requested_tests_csv || null,
        }])
        .select("id")
        .single();
      if (insErr) throw insErr;
      encounter_id = ins.id;
    } else {
      encounter_id = existing.id;
      if (requested_tests_csv) {
        await db.from("encounters")
          .update({ notes_frontdesk: requested_tests_csv, yakap_flag: !!yakap_flag, is_philhealth_claim: !!yakap_flag })
          .eq("id", encounter_id);
      }
    }

    // 3) Expand tokens (packages -> test codes)
    const tokens: string[] = (requested_tests_csv || "")
      .split(",").map((s: string) => s.trim()).filter(Boolean);

    let expanded = [...tokens];

    if (tokens.length) {
      // try by package_code
      const { data: items1 } = await db
        .from("package_items")
        .select("package_code,test_code")
        .in("package_code", tokens);

      let items = items1 || [];

      // fallback: package display_name -> code
      if (items.length === 0) {
        const { data: packsByName } = await db
          .from("packages")
          .select("package_code,display_name")
          .in("display_name", tokens);
        const codes = (packsByName || []).map(p => p.package_code);
        if (codes.length) {
          const { data: items2 } = await db
            .from("package_items")
            .select("package_code,test_code")
            .in("package_code", codes);
          items = items2 || [];
        }
      }

      if (items.length) {
        const byPack = new Map<string,string[]>();
        for (const r of items) {
          const k = String((r as any).package_code || "").toUpperCase();
          const arr = byPack.get(k) || [];
          if ((r as any).test_code) arr.push(String((r as any).test_code));
          byPack.set(k, arr);
        }
        expanded = tokens.flatMap((t: string) => byPack.get(t.toUpperCase()) ?? [t]);
      }
    }

    // 4) Server-side pricing (trust the server)
    // Build catalogs
    const [{ data: tests }, { data: packs }] = await Promise.all([
      db.from("tests_catalog").select("test_code,default_price,is_active").eq("is_active", true),
      db.from("packages").select("package_code,package_price"),
    ]);

    const testPrice = new Map<string, number>();
    (tests || []).forEach(t => testPrice.set(String(t.test_code).toUpperCase(), Number(t.default_price || 0)));

    const packPrice = new Map<string, number>();
    (packs || []).forEach(p => packPrice.set(String(p.package_code).toUpperCase(), Number(p.package_price || 0)));

    // Identify which tokens are packages vs tests
    const tokenSet = new Set(expanded.map(t => t.toUpperCase()));
    const originalTokenSet = new Set(tokens.map(t => t.toUpperCase()));

    // If a package token was present originally, prefer package price and exclude its member tests from auto sum
    // To do this, we need the items per package:
    const { data: allItems } = await db.from("package_items").select("package_code,test_code");
    const packMembers: Record<string, Set<string>> = {};
    (allItems || []).forEach(it => {
      const p = String(it.package_code).toUpperCase();
      const tc = String(it.test_code).toUpperCase();
      if (!packMembers[p]) packMembers[p] = new Set();
      packMembers[p].add(tc);
    });

    let autoTotal = 0;

    // Add package prices for any package token present
    for (const tok of originalTokenSet) {
      if (packPrice.has(tok)) {
        autoTotal += packPrice.get(tok)!;
        // exclude covered tests from addition
        const members = packMembers[tok];
        if (members) {
          for (const m of members) tokenSet.delete(m);
        }
      }
    }

    // Add test prices for remaining (non-covered) codes
    for (const tok of tokenSet) {
      if (testPrice.has(tok)) {
        autoTotal += testPrice.get(tok)!;
      }
    }

    const manualAdd = Math.max(0, Number(price_manual_add || 0));
    const finalTotal = autoTotal + manualAdd;

    // Save a single order_items row with expanded list (as now)
    if (expanded.length) {
      await db.from("order_items").insert([{
        encounter_id,
        kind: "manual",
        code_or_name: expanded.join(", "),
        qty: 1,
        source,
      }]).select("id").maybeSingle();
    }

    // Persist pricing on encounter
    await db.from("encounters").update({
      price_auto_total: autoTotal,
      price_manual_add: manualAdd,
      total_price: finalTotal
    }).eq("id", encounter_id);

    // 5) Queue now (optional)
    if (queue_now) {
      const { data: enc } = await db.from("encounters").select("status").eq("id", encounter_id).single();
      if (enc?.status === "intake") {
        await db.from("encounters").update({ status: "for-extract" }).eq("id", encounter_id);
      }
    }

    // 6) Append to Running Sheet
    await appendRunningRow(branch_code, {
      patient_id: pid,
      full_name: up(patient.full_name),
      age: "", // sheet computes
      sex: up(patient.sex) as "M" | "F",
      birthday: patient.birthday_mmddyyyy,
      contact: patient.contact || "",
      address: patient.address || "",
      notes: requested_tests_csv || "",
    });

    return NextResponse.json({ ok: true, encounter_id, totals: { auto: autoTotal, manual: manualAdd, final: finalTotal } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 400 });
  }
}

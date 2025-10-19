import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const db = supa();
  try {
    const body = await req.json().catch(() => ({}));
    const { id, requested_tests_csv, price_manual_add = 0 } = body || {};
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    // Expand packages -> tests (like intake)
    const tokens: string[] = String(requested_tests_csv || "")
      .split(",").map((s) => s.trim()).filter(Boolean);

    let expanded = [...tokens];

    if (tokens.length) {
      const { data: items1 } = await db
        .from("package_items")
        .select("package_code,test_code")
        .in("package_code", tokens);

      let items = items1 || [];

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

    // Pricing
    const [{ data: tests }, { data: packs }, { data: allItems }] = await Promise.all([
      db.from("tests_catalog").select("test_code,default_price,is_active").eq("is_active", true),
      db.from("packages").select("package_code,package_price"),
      db.from("package_items").select("package_code,test_code"),
    ]);

    const testPrice = new Map<string, number>();
    (tests || []).forEach((t) =>
      testPrice.set(String(t.test_code).toUpperCase(), Number(t.default_price || 0))
    );

    const packPrice = new Map<string, number>();
    (packs || []).forEach((p) =>
      packPrice.set(String(p.package_code).toUpperCase(), Number(p.package_price || 0))
    );

    const packMembers: Record<string, Set<string>> = {};
    (allItems || []).forEach((it) => {
      const p = String(it.package_code).toUpperCase();
      const tc = String(it.test_code).toUpperCase();
      if (!packMembers[p]) packMembers[p] = new Set();
      packMembers[p].add(tc);
    });

    const originalTokenSet = new Set(tokens.map((t) => t.toUpperCase()));
    const tokenSet = new Set(expanded.map((t) => t.toUpperCase()));

    let autoTotal = 0;
    for (const tok of originalTokenSet) {
      if (packPrice.has(tok)) {
        autoTotal += packPrice.get(tok)!;
        const members = packMembers[tok];
        if (members) for (const m of members) tokenSet.delete(m);
      }
    }
    for (const tok of tokenSet) if (testPrice.has(tok)) autoTotal += testPrice.get(tok)!;

    const manual = Math.max(0, Number(price_manual_add || 0));
    const final = autoTotal + manual;

    // Update encounter + replace manual order_items
    await db.from("encounters").update({
      notes_frontdesk: requested_tests_csv || null,
      price_manual_add: manual,
      price_auto_total: autoTotal,
      total_price: final,
    }).eq("id", id);

    await db.from("order_items").delete().match({ encounter_id: id, kind: "manual" });

    if (expanded.length) {
      await db.from("order_items").insert([{
        encounter_id: id,
        kind: "manual",
        code_or_name: expanded.join(", "),
        qty: 1,
        source: "admin-edit",
      }]);
    }

    return NextResponse.json({ ok: true, totals: { auto: autoTotal, manual, final } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

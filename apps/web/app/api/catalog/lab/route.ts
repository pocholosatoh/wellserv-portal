import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const db = supa();
  try {
    const { data: testsRaw, error: te } = await db
      .from("tests_catalog")
      .select("test_code, display_name, default_price, is_active")
      .eq("is_active", true)
      .order("display_name", { ascending: true });
    if (te) throw te;

    const { data: packsRaw, error: pe } = await db
      .from("packages")
      .select("package_code, display_name, package_price")
      .order("display_name", { ascending: true });
    if (pe) throw pe;

    const { data: itemsRaw, error: ie } = await db
      .from("package_items")
      .select("package_code, test_code");
    if (ie) throw ie;

    const tests = (testsRaw || []).map(r => ({
      code: r.test_code,
      name: r.display_name,
      price: r.default_price ?? null,
    }));

    const packages = (packsRaw || []).map(r => ({
      code: r.package_code,
      name: r.display_name,
      price: r.package_price ?? null,
    }));

    const packageMap: Record<string, string[]> = {};
    (itemsRaw || []).forEach(r => {
      const k = String(r.package_code || "").toUpperCase();
      if (!k) return;
      if (!packageMap[k]) packageMap[k] = [];
      if (r.test_code) packageMap[k].push(String(r.test_code));
    });

    return NextResponse.json({ tests, packages, packageMap });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildLabCatalogIndex } from "@/lib/labSelection";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const db = getSupabase();
  try {
    const auth = await guard(req, { allow: ["doctor", "staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const { data: testsRaw, error: te } = await db
      .from("tests_catalog")
      .select("id, test_code, display_name, default_price, is_active")
      .order("display_name", { ascending: true });
    if (te) throw te;

    const { data: packsRaw, error: pe } = await db
      .from("packages")
      .select("id, package_code, display_name, package_price")
      .order("display_name", { ascending: true });
    if (pe) throw pe;

    const { data: itemsRaw, error: ie } = await db
      .from("package_items")
      .select("package_id, test_id");
    if (ie) throw ie;

    const activeTestsRaw = (testsRaw || []).filter((t) => t.is_active);
    const index = buildLabCatalogIndex(testsRaw || [], packsRaw || [], itemsRaw || []);

    console.info("[catalog/lab] loaded", {
      tests: testsRaw?.length || 0,
      active_tests: activeTestsRaw.length,
      packages: packsRaw?.length || 0,
      items: itemsRaw?.length || 0,
    });

    const tests = activeTestsRaw.map((r) => ({
      id: r.id,
      test_code: r.test_code,
      display_name: r.display_name,
      default_price: r.default_price ?? null,
      is_active: r.is_active ?? null,
      code: r.test_code,
      name: r.display_name,
      price: r.default_price ?? null,
    }));

    const packages = (packsRaw || []).map((r) => ({
      id: r.id,
      package_code: r.package_code,
      display_name: r.display_name,
      package_price: r.package_price ?? null,
      code: r.package_code,
      name: r.display_name,
      price: r.package_price ?? null,
    }));

    const packageItems = (itemsRaw || []).map((r) => ({
      package_id: r.package_id,
      test_id: r.test_id,
      package_code: r.package_id ? index.packageCodeById.get(r.package_id) || null : null,
      test_code: r.test_id ? index.testCodeById.get(r.test_id) || null : null,
    }));

    const packageMap: Record<string, string[]> = {};
    const packageMapById: Record<string, string[]> = {};

    packageItems.forEach((r) => {
      if (r.package_id && r.test_id) {
        if (!packageMapById[r.package_id]) packageMapById[r.package_id] = [];
        packageMapById[r.package_id].push(r.test_id);
      }

      const k = String(r.package_code || "").toUpperCase();
      if (!k || !r.test_code) return;
      if (!packageMap[k]) packageMap[k] = [];
      packageMap[k].push(String(r.test_code));
    });

    return NextResponse.json({
      tests,
      packages,
      package_items: packageItems,
      packageMap,
      packageMapById,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

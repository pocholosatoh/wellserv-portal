export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const auth = await guard(req, { allow: ["staff"] });
  if (!auth.ok) return auth.response;

  const supabase = getSupabase();

  const { data: summaryRows, error: summaryErr } = await supabase
    .from("v_supplies_global_inventory_summary")
    .select(
      "item_id,total_pcs_all,remaining_pcs_all,total_pcs_available,remaining_pcs_available,nearest_expiry_date,active_batches_count",
    )
    .order("item_id", { ascending: true });

  if (summaryErr) {
    return NextResponse.json({ error: summaryErr.message }, { status: 500 });
  }

  const itemIds = Array.from(new Set((summaryRows || []).map((r) => r.item_id)));
  const itemsMap = new Map<string, { item_name: string; packaging_type: string; pcs_per_package: number }>();

  if (itemIds.length) {
    const { data: itemRows, error: itemsErr } = await supabase
      .from("supplies_items")
      .select("id,item_name,packaging_type,pcs_per_package")
      .in("id", itemIds);
    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }
    (itemRows || []).forEach((row) => {
      itemsMap.set(row.id, {
        item_name: row.item_name || "Unnamed item",
        packaging_type: row.packaging_type,
        pcs_per_package: row.pcs_per_package,
      });
    });
  }

  const nextExpiriesMap = new Map<string, Array<{ expiry_date: string; remaining_pcs: number }>>();
  if (itemIds.length) {
    const { data: nextRows, error: nextErr } = await supabase
      .from("v_supplies_global_next_expiries")
      .select("item_id,expiry_date,remaining_pcs")
      .order("expiry_date", { ascending: true });
    if (nextErr) {
      return NextResponse.json({ error: nextErr.message }, { status: 500 });
    }
    (nextRows || []).forEach((row) => {
      if (!row.item_id) return;
      const list = nextExpiriesMap.get(row.item_id) || [];
      if (list.length < 3) {
        list.push({ expiry_date: row.expiry_date, remaining_pcs: row.remaining_pcs });
        nextExpiriesMap.set(row.item_id, list);
      }
    });
  }

  const items = (summaryRows || [])
    .map((row) => {
      const meta = itemsMap.get(row.item_id) || {
        item_name: "Unnamed item",
        packaging_type: null,
        pcs_per_package: null,
      };
      return {
        item_id: row.item_id,
        item_name: meta.item_name,
        packaging_type: meta.packaging_type ?? null,
        pcs_per_package: meta.pcs_per_package ?? null,
        total_pcs_all: row.total_pcs_all ?? 0,
        remaining_pcs_all: row.remaining_pcs_all ?? 0,
        total_pcs_available: row.total_pcs_available ?? 0,
        remaining_pcs_available: row.remaining_pcs_available ?? 0,
        nearest_expiry_date: row.nearest_expiry_date ?? null,
        active_batches_count: row.active_batches_count ?? 0,
        next_expiries: nextExpiriesMap.get(row.item_id) || [],
      };
    })
    .sort((a, b) => a.item_name.localeCompare(b.item_name));

  return NextResponse.json({ items });
}

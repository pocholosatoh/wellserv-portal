export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

function normalizeBranch(raw?: string | null) {
  const value = String(raw || "")
    .trim()
    .toUpperCase();
  if (value === "SI" || value === "SL") return value;
  return "";
}

async function getStaffContext() {
  const session = await getSession().catch(() => null);
  if (!session || session.role !== "staff") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const c = await cookies();
  const branch = normalizeBranch(session.staff_branch || c.get("staff_branch")?.value);
  if (!branch) {
    return {
      error: NextResponse.json(
        { error: "Branch not set. Please select a branch in the header." },
        { status: 400 },
      ),
    };
  }
  return { branch };
}

export async function GET() {
  const ctx = await getStaffContext();
  if ("error" in ctx) return ctx.error;

  const supabase = getSupabase();

  const { data: summaryRows, error: summaryErr } = await supabase
    .from("v_supplies_inventory_summary")
    .select(
      "branch_code,item_id,total_pcs_all,remaining_pcs_all,total_pcs_available,remaining_pcs_available,nearest_expiry_date,active_batches_count",
    )
    .eq("branch_code", ctx.branch)
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
      .from("v_supplies_next_expiries")
      .select("branch_code,item_id,expiry_date,remaining_pcs")
      .eq("branch_code", ctx.branch)
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

  return NextResponse.json({ branch_code: ctx.branch, items });
}

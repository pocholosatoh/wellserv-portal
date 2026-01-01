export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

const PACKAGING_TYPES = new Set(["box", "bundle", "pack", "bag", "bottle"]);

function normalizeBranch(raw?: string | null) {
  const value = String(raw || "")
    .trim()
    .toUpperCase();
  if (value === "SI" || value === "SL") return value;
  return "";
}

function escapeLikeExact(value: string) {
  return value.replace(/[%_]/g, (m) => `\\${m}`);
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

  const staffId = session.staff_id || c.get("staff_id")?.value || null;
  return { branch, staffId };
}

export async function POST(req: Request) {
  const ctx = await getStaffContext();
  if ("error" in ctx) return ctx.error;

  const body = await req.json().catch(() => ({}));
  const item_name = String(body?.item_name || "").trim();
  const packaging_type = String(body?.packaging_type || "")
    .trim()
    .toLowerCase();
  const pcs_per_package = Number(body?.pcs_per_package);
  const packaging_count = Number(body?.packaging_count);
  const expiry_date = String(body?.expiry_date || "").trim();
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!item_name) {
    return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  }
  if (!PACKAGING_TYPES.has(packaging_type)) {
    return NextResponse.json({ error: "Invalid packaging type." }, { status: 400 });
  }
  if (!Number.isInteger(pcs_per_package) || pcs_per_package <= 0) {
    return NextResponse.json({ error: "PCS per package must be a positive integer." }, { status: 400 });
  }
  if (!Number.isInteger(packaging_count) || packaging_count <= 0) {
    return NextResponse.json({ error: "Packaging count must be a positive integer." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
    return NextResponse.json({ error: "Expiry date is required." }, { status: 400 });
  }

  const added_pcs = pcs_per_package * packaging_count;

  const supabase = getSupabase();
  const { data: existing, error: existingErr } = await supabase
    .from("supplies_items")
    .select("id,item_name,packaging_type,pcs_per_package")
    .ilike("item_name", escapeLikeExact(item_name))
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  let itemId = existing?.id || null;
  if (existing) {
    const existingType = String(existing.packaging_type || "").toLowerCase();
    const existingPcs = Number(existing.pcs_per_package);
    if (existingType !== packaging_type || existingPcs !== pcs_per_package) {
      return NextResponse.json(
        {
          error:
            "Item already exists with different packaging/pcs per package. Please select correct item settings.",
        },
        { status: 400 },
      );
    }
  } else {
    const payload: Record<string, any> = {
      item_name,
      packaging_type,
      pcs_per_package,
    };
    if (ctx.staffId) payload.created_by_staff_id = ctx.staffId;

    const { data: inserted, error: insertErr } = await supabase
      .from("supplies_items")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (insertErr || !inserted?.id) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create item." },
        { status: 500 },
      );
    }
    itemId = inserted.id;
  }

  const branchCode = ctx.branch;
  const staffId = ctx.staffId ?? null;

  const { data: rpcData, error: rpcErr } = await supabase.rpc("supplies_receive", {
    p_branch_code: branchCode,
    p_item_id: itemId,
    p_added_pcs: added_pcs,
    p_expiry_date: expiry_date,
    p_staff_id: staffId,
    p_notes: notes ?? null,
  });

  if (rpcErr) {
    console.error("[supplies/receive] rpc error", rpcErr);
    return NextResponse.json(
      { error: rpcErr.message, details: rpcErr.details ?? null },
      { status: 400 },
    );
  }

  const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;

  return NextResponse.json({
    ok: true,
    branch_code: branchCode,
    item_id: itemId,
    added_pcs,
    batch_id: rpcRow?.batch_id ?? null,
    remaining_pcs: rpcRow?.remaining_pcs ?? null,
  });
}

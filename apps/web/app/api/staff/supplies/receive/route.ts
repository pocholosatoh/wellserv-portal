export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

function escapeLikeExact(value: string) {
  return value.replace(/[%_]/g, (m) => `\\${m}`);
}

function isUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(req: Request) {
  const auth = await guard(req, { allow: ["staff"], requireBranch: true });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const item_id = String(body?.item_id || "").trim();
  const item_name = String(body?.item_name || "").trim();
  const qty_pcs = Number(body?.qty_pcs);
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!Number.isInteger(qty_pcs) || qty_pcs <= 0) {
    return NextResponse.json({ error: "qty_pcs must be a positive integer." }, { status: 400 });
  }

  const supabase = getSupabase();
  let itemId = isUuid(item_id) ? item_id : null;
  if (!itemId) {
    if (!item_name) {
      return NextResponse.json({ error: "item_id is required." }, { status: 400 });
    }

    const { data: existing, error: existingErr } = await supabase
      .from("supplies_items")
      .select("id")
      .ilike("item_name", escapeLikeExact(item_name))
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }
    if (!existing?.id) {
      return NextResponse.json({ error: "Item not found in supplies catalog." }, { status: 400 });
    }
    itemId = existing.id;
  }

  const branchCode = auth.branch === "ALL" ? "SI" : auth.branch;
  const staffId = auth.actor.kind === "staff" && isUuid(auth.actor.id) ? auth.actor.id : null;

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "supplies_transfer_from_global_fefo",
    {
      p_branch_code: branchCode,
      p_item_id: itemId,
      p_qty_pcs: qty_pcs,
      p_staff_id: staffId,
      p_notes: notes ?? null,
    },
  );

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
    qty_pcs,
    transferred_total: rpcRow?.transferred_total ?? qty_pcs,
    branch_remaining_after_available: rpcRow?.branch_remaining_after_available ?? null,
    global_remaining_after_available: rpcRow?.global_remaining_after_available ?? null,
  });
}

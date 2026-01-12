export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

const PACKAGING_TYPES = new Set(["box", "bundle", "pack", "bag", "bottle"]);

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
  const auth = await guard(req, { allow: ["staff"] });
  if (!auth.ok) return auth.response;

  if (auth.actor.kind !== "staff" || !auth.actor.is_admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const item_id = String(body?.item_id || "").trim();
  const item_name = String(body?.item_name || "").trim();
  const packaging_type = String(body?.packaging_type || "")
    .trim()
    .toLowerCase();
  const pcs_per_package = Number(body?.pcs_per_package);
  const packaging_count = Number(body?.packaging_count);
  const expiry_date = String(body?.expiry_date || "").trim();
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!item_name && !isUuid(item_id)) {
    return NextResponse.json({ error: "Item name or item_id is required." }, { status: 400 });
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
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(expiry_date)) {
    return NextResponse.json({ error: "Expiry date is required." }, { status: 400 });
  }

  const added_pcs = pcs_per_package * packaging_count;
  const supabase = getSupabase();

  let itemId = isUuid(item_id) ? item_id : null;
  if (itemId) {
    const { data: existing, error: existingErr } = await supabase
      .from("supplies_items")
      .select("id,item_name,packaging_type,pcs_per_package")
      .eq("id", itemId)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }
    if (!existing?.id) {
      return NextResponse.json({ error: "Item not found." }, { status: 400 });
    }

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
    const { data: existing, error: existingErr } = await supabase
      .from("supplies_items")
      .select("id,item_name,packaging_type,pcs_per_package")
      .ilike("item_name", escapeLikeExact(item_name))
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

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
      itemId = existing.id;
    } else {
      const payload: Record<string, any> = {
        item_name,
        packaging_type,
        pcs_per_package,
      };
      const staffId = auth.actor.kind === "staff" && isUuid(auth.actor.id) ? auth.actor.id : null;
      if (staffId) payload.created_by_staff_id = staffId;

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
  }

  const staffId = auth.actor.kind === "staff" && isUuid(auth.actor.id) ? auth.actor.id : null;

  const { data: rpcData, error: rpcErr } = await supabase.rpc("supplies_global_receive", {
    p_item_id: itemId,
    p_added_pcs: added_pcs,
    p_expiry_date: expiry_date,
    p_staff_id: staffId,
    p_notes: notes ?? null,
  });

  if (rpcErr) {
    console.error("[supplies/global/receive] rpc error", rpcErr);
    return NextResponse.json(
      { error: rpcErr.message, details: rpcErr.details ?? null },
      { status: 400 },
    );
  }

  const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;

  return NextResponse.json({
    ok: true,
    item_id: itemId,
    added_pcs,
    batch_id: rpcRow?.batch_id ?? null,
    remaining_pcs: rpcRow?.remaining_pcs ?? null,
  });
}

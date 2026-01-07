export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

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
  const qty_pcs = Number(body?.qty_pcs);
  const reference = body?.reference ? String(body.reference).trim() : null;
  const notes = body?.notes ? String(body.notes).trim() : null;
  const patient_id = body?.patient_id ? String(body.patient_id).trim() : null;
  const encounter_id = body?.encounter_id ? String(body.encounter_id).trim() : null;

  if (!item_id) {
    return NextResponse.json({ error: "item_id is required." }, { status: 400 });
  }
  if (!Number.isInteger(qty_pcs) || qty_pcs <= 0) {
    return NextResponse.json({ error: "qty_pcs must be a positive integer." }, { status: 400 });
  }

  const supabase = getSupabase();
  const branchCode = auth.branch === "ALL" ? "SI" : auth.branch;
  const staffId = auth.actor.kind === "staff" && isUuid(auth.actor.id) ? auth.actor.id : null;
  const patientId = patient_id ?? null;
  const encounterId = encounter_id ?? null;

  const { data: rpcData, error: rpcErr } = await supabase.rpc("supplies_dispense_fefo", {
    p_branch_code: branchCode,
    p_item_id: item_id,
    p_qty_pcs: qty_pcs,
    p_staff_id: staffId,
    p_patient_id: patientId,
    p_encounter_id: encounterId,
    p_reference: reference ?? null,
    p_notes: notes ?? null,
  });

  if (rpcErr) {
    console.error("[supplies/dispense] rpc error", rpcErr);
    return NextResponse.json(
      { error: rpcErr.message, details: rpcErr.details ?? null },
      { status: 400 },
    );
  }

  const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;

  return NextResponse.json({
    ok: true,
    dispensed_total: rpcRow?.dispensed_total ?? qty_pcs,
    remaining_after_available: rpcRow?.remaining_after_available ?? null,
  });
}

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

  const staffId = session.staff_id || c.get("staff_id")?.value || null;
  return { branch, staffId };
}

export async function POST(req: Request) {
  const ctx = await getStaffContext();
  if ("error" in ctx) return ctx.error;

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
  const branchCode = ctx.branch;
  const staffId = ctx.staffId ?? null;
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

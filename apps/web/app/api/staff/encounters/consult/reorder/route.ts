// app/api/staff/encounters/consult/reorder/route.ts
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST body:
 * {
 *   "branch": "SI" | "SL",
 *   "ids": ["encounter-uuid-1", "encounter-uuid-2", ...]
 * }
 * The first ID gets queue_number=1, second gets 2, etc.
 * Only applies to rows with consult_status in ('queued_for_consult','in_consult') for that branch.
 */
export async function POST(req: Request) {
  const db = getSupabase();
  try {
    const { branch, ids } = await req.json();

    if (!branch || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "branch and non-empty ids[] are required" },
        { status: 400 }
      );
    }
    if (!["SI", "SL"].includes(String(branch).toUpperCase())) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    // Assign consecutive numbers based on the given order
    // Step 1: clear queue numbers to avoid transient duplicates (unique constraint)
    const { error: clearErr } = await db
      .from("encounters")
      .update({ queue_number: null })
      .match({ branch_code: branch })
      .in("id", ids)
      .in("consult_status", ["queued_for_consult", "in_consult"]);
    if (clearErr) throw new Error(clearErr.message);

    // Step 2: apply new ordering from top (idx 0 -> queue 1, etc.)
    for (let idx = 0; idx < ids.length; idx++) {
      const encId = ids[idx];
      const newQueueNumber = idx + 1;

      const { error } = await db
        .from("encounters")
        .update({ queue_number: newQueueNumber })
        .match({ id: encId, branch_code: branch })
        .in("consult_status", ["queued_for_consult", "in_consult"]);

      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

// app/api/staff/encounters/consult/reorder/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Supabase (server) */
function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

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
  const db = supa();
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
    let n = 1;
    for (const encId of ids) {
      const { error } = await db
        .from("encounters")
        .update({ queue_number: n++ })
        .match({ id: encId, branch_code: branch })
        .in("consult_status", ["queued_for_consult", "in_consult"]);

      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

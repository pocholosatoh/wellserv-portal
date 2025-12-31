// app/api/staff/encounters/consult/toggle/route.ts
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** YYYY-MM-DD in Asia/Manila by default */
function todayISOin(tz = process.env.APP_TZ || "Asia/Manila") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Find next available queue number for (branch, date) among consult-queued encounters */
async function nextQueueNumber(
  db: ReturnType<typeof getSupabase>,
  branch: string,
  visitDate: string,
) {
  const { data, error } = await db
    .from("encounters")
    .select("queue_number")
    .eq("branch_code", branch)
    .eq("visit_date_local", visitDate)
    .in("consult_status", ["queued_for_consult", "in_consult"])
    .not("queue_number", "is", null)
    .order("queue_number", { ascending: true });

  if (error) throw new Error(error.message);
  const used = new Set<number>((data || []).map((r: any) => r.queue_number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/**
 * POST body:
 * {
 *   "encounter_id": "uuid",
 *   "branch": "SI" | "SL",
 *   "enable": true | false
 * }
 */
export async function POST(req: Request) {
  const db = getSupabase();
  try {
    const { encounter_id, branch, enable } = await req.json();
    const branchCode = String(branch || "").toUpperCase();

    if (!encounter_id || !branchCode || typeof enable !== "boolean") {
      return NextResponse.json(
        { error: "encounter_id, branch, enable are required" },
        { status: 400 },
      );
    }
    if (!["SI", "SL"].includes(branchCode)) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    const today = todayISOin();

    if (enable) {
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const qn = await nextQueueNumber(db, branchCode, today);

        const { error } = await db
          .from("encounters")
          .update({
            for_consult: true,
            consult_status: "queued_for_consult",
            queue_number: qn,
          })
          .match({
            id: encounter_id,
            branch_code: branchCode,
            visit_date_local: today,
          });

        if (!error) {
          return NextResponse.json({
            ok: true,
            queue_number: qn,
            consult_status: "queued_for_consult",
          });
        }

        const msg = String(error.message || "");
        if (
          !/uq_enc_consult_queue_active/i.test(msg) &&
          !/duplicate key value violates unique constraint/i.test(msg)
        ) {
          throw new Error(msg);
        }

        // Another staff member likely grabbed the same queue slot;
        // retry with a fresh queue lookup (loop continues).
        await new Promise((resolve) => setTimeout(resolve, 40));
      }

      throw new Error("Consult queue just changed. Please try again.");
    }

    // Disable: remove from consult queue (do not touch lab `status`)
    const { error } = await db
      .from("encounters")
      .update({
        for_consult: false,
        consult_status: null,
        queue_number: null,
      })
      .eq("id", encounter_id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, queue_number: null, consult_status: null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

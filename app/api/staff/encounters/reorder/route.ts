import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST body: { branch: "SI"|"SL", ids: string[] }
 * Sets priority so that ids[0] has the highest priority.
 */
export async function POST(req: Request) {
  try {
    const { branch, ids } = await req.json();
    if (!branch || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = supa();

    // Highest priority at top; descending integers
    let pr = ids.length;
    for (const id of ids) {
      // ignore rows not in this branch (safety)
      await db.from("encounters").update({ priority: pr-- }).match({
        id,
        branch_code: branch,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

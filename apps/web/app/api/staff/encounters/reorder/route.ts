import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

/**
 * POST body: { branch: "SI"|"SL", ids: string[] }
 * Sets priority so that ids[0] has the highest priority.
 */
export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"], requireBranch: true });
    if (!auth.ok) return auth.response;
    const { branch, ids } = await req.json();
    if (!branch || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = getSupabase();

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

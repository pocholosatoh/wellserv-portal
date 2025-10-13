// app/api/followups/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const supa = getSupabase();
    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start"); // YYYY-MM-DD
    const end = searchParams.get("end");     // YYYY-MM-DD
    const branch = searchParams.get("branch"); // optional
    const status = searchParams.get("status"); // optional

    let q = supa
      .from("followups")
      .select("*")
      .order("due_date", { ascending: true });

    if (start) q = q.gte("due_date", start);
    if (end) q = q.lte("due_date", end);
    if (branch) q = q.eq("return_branch", branch);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ followups: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

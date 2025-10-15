// app/api/followups/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const s = await getSession();
    if (!s || s.role !== "staff") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const start = (searchParams.get("start") || "").trim();   // YYYY-MM-DD
    const end   = (searchParams.get("end") || "").trim();     // YYYY-MM-DD
    const branch = (searchParams.get("branch") || "").trim(); // optional
    const status = (searchParams.get("status") || "all").trim();

    if (!start || !end) {
      return NextResponse.json({ error: "start and end are required" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    let q = sb
      .from("followups")
      .select(
        "id, patient_id, created_from_consultation_id, closed_by_consultation_id, return_branch, due_date, tolerance_days, valid_until, intended_outcome, expected_tests, status, cancel_reason, created_at, updated_at",
        { count: "exact" }
      )
      .is("deleted_at", null)
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date", { ascending: true });

    if (branch) q = q.eq("return_branch", branch);
    if (status && status !== "all") q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ followups: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// app/api/followups/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActor } from "@/lib/api-actor";

/*
Behavior:
- Auth: allow staff or doctor or patient (patient rarely uses this, but we won’t block).
- Date range required (start, end). Returns due_date within [start, end].
- Branch filtering:
  - If caller provided ?branch=SI|SL → filter by code, but also match legacy text values.
  - If blank → no branch filter (see “All”).
- Status filtering: status=all|scheduled|completed|canceled|skipped
- Ignores deleted rows (deleted_at IS NULL)
*/

export async function GET(req: Request) {
  try {
    const actor = await requireActor(); // doctor/staff/patient
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const start = (searchParams.get("start") || "").trim();   // YYYY-MM-DD
    const end   = (searchParams.get("end") || "").trim();     // YYYY-MM-DD
    const branchParam = (searchParams.get("branch") || "").trim().toUpperCase(); // "" | SI | SL
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

    // Branch logic:
    // - If a branch is specified (SI/SL), match code OR legacy text.
    // - If empty: no branch filter (shows all).
    if (branchParam === "SI" || branchParam === "SL") {
      const legacyText = branchParam === "SL" ? "San Leonardo%" : "San Isidro%";
      q = q.or(
        [
          `return_branch.eq.${branchParam}`,       // code
          `return_branch.ilike.${legacyText}`,     // legacy free text
        ].join(",")
      );
    }

    if (status && status !== "all") q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ followups: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

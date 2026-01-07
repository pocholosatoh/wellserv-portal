// app/api/followups/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { guard } from "@/lib/auth/guard";

type DoctorRow = {
  doctor_id: string;
  display_name?: string | null;
  full_name?: string | null;
  credentials?: string | null;
};

function isUuid(v?: string | null) {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeLikeExact(input: string) {
  return input.replace(/[%_]/g, (m) => `\\${m}`);
}

function formatDoctorName(row: DoctorRow | null) {
  if (!row) return null;
  const base = (row.display_name || row.full_name || "").trim();
  if (!base) return null;
  const cred = (row.credentials || "").trim();
  if (cred) {
    const suffix = new RegExp(`,\\s*${escapeRegExp(cred)}$`);
    if (!suffix.test(base)) return `${base}, ${cred}`;
  }
  return base;
}

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
    const auth = await guard(req, { allow: ["doctor", "staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const start = (searchParams.get("start") || "").trim(); // YYYY-MM-DD
    const end = (searchParams.get("end") || "").trim(); // YYYY-MM-DD
    const branchParam = (searchParams.get("branch") || "").trim().toUpperCase(); // "" | SI | SL
    const patientId = (searchParams.get("patient_id") || searchParams.get("pid") || "").trim();
    const status = (searchParams.get("status") || "all").trim();

    if (!start || !end) {
      return NextResponse.json({ error: "start and end are required" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    let q = sb
      .from("followups")
      .select(
        "id, patient_id, created_from_consultation_id, closed_by_consultation_id, return_branch, due_date, tolerance_days, valid_until, intended_outcome, expected_tests, status, cancel_reason, created_at, updated_at, created_by, updated_by",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date", { ascending: true });

    // Branch logic:
    // - If a branch is specified (SI/SL), match code OR legacy text.
    // - If empty: no branch filter (shows all).
    const resolvedBranch =
      auth.branch && auth.branch !== "ALL" ? auth.branch : (branchParam as any);
    if (resolvedBranch === "SI" || resolvedBranch === "SL") {
      const legacyText = resolvedBranch === "SL" ? "San Leonardo%" : "San Isidro%";
      q = q.or(
        [
          `return_branch.eq.${resolvedBranch}`, // code
          `return_branch.ilike.${legacyText}`, // legacy free text
        ].join(","),
      );
    }

    if (patientId) q = q.ilike("patient_id", escapeLikeExact(patientId));
    if (status && status !== "all") q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;

    const rows: any[] = data ?? [];
    const doctorIds = new Set<string>();
    rows.forEach((row) => {
      if (isUuid(row?.created_by)) doctorIds.add(row.created_by);
      if (isUuid(row?.updated_by)) doctorIds.add(row.updated_by);
    });

    const doctorMap = new Map<string, string>();
    if (doctorIds.size) {
      const { data: docs, error: docErr } = await sb
        .from("doctors")
        .select("doctor_id, display_name, full_name, credentials")
        .in("doctor_id", Array.from(doctorIds));
      if (docErr) throw docErr;
      (docs || []).forEach((doc: DoctorRow) => {
        const label = formatDoctorName(doc);
        if (label) doctorMap.set(doc.doctor_id, label);
      });
    }

    const withNames = rows.map((row) => ({
      ...row,
      created_by_name: isUuid(row?.created_by) ? doctorMap.get(row.created_by) || null : null,
      updated_by_name: isUuid(row?.updated_by) ? doctorMap.get(row.updated_by) || null : null,
    }));

    return NextResponse.json({ followups: withNames });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// app/api/consultations/resolve-id/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

/*
  GET /api/consultations/resolve-id?patient_id=...&scope=latest|today&branchOnly=1
  - default scope=latest → newest consultation for that patient (any date)
  - scope=today        → restrict to "today" (Asia/Manila or APP_TZ)
  - branchOnly=1       → also require the doctor_branch cookie's branch (optional)
*/
function todayYMD(tz = process.env.APP_TZ || "Asia/Manila") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(req: Request) {
  try {
    const auth = await guard(req, {
      allow: ["doctor"],
      requireBranch: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;
    const url = new URL(req.url);
    const patientId = String(auth.patientId || "").trim();
    const scope = (url.searchParams.get("scope") || "latest").toLowerCase(); // latest|today
    const branchOnly = url.searchParams.get("branchOnly") === "1";

    if (!patientId) {
      return NextResponse.json({ error: "patient_id required" }, { status: 400 });
    }

    const db = getSupabase();
    let q = db.from("consultations").select("id, visit_at, branch").eq("patient_id", patientId);

    if (branchOnly && auth.branch) {
      q = q.eq("branch", auth.branch);
    }

    if (scope === "today") {
      const ymd = todayYMD();
      const start = `${ymd}T00:00:00+08:00`;
      const end = `${ymd}T23:59:59.999+08:00`;
      q = q.gte("visit_at", start).lte("visit_at", end);
    }

    const { data, error } = await q.order("visit_at", { ascending: false }).limit(1).maybeSingle();

    if (error) throw error;
    return NextResponse.json({ consultation_id: data?.id || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

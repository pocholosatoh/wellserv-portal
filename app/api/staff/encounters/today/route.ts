// app/api/staff/encounters/today/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function todayISOin(tz = process.env.APP_TZ || "Asia/Manila") {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const branch = (url.searchParams.get("branch") || "SI").toUpperCase();
    if (!["SI", "SL"].includes(branch)) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    const db = supa();
    const today = todayISOin();

    // 1) Pull encounters for today + branch
    const { data: encs, error: e1 } = await db
      .from("encounters")
      .select(
        "id,patient_id,branch_code,status,priority,notes_frontdesk,visit_date_local,total_price,is_philhealth_claim,yakap_flag"
      )
      .eq("branch_code", branch)
      .eq("visit_date_local", today)
      .order("priority", { ascending: false });
    if (e1) throw e1;

    const rows = encs || [];
    if (rows.length === 0) return NextResponse.json({ rows: [] });

    // 2) Fetch names + contacts in one go
    const pids = rows.map((r) => r.patient_id);
    const { data: pats, error: e2 } = await db
      .from("patients")
      .select("patient_id,full_name,contact")
      .in("patient_id", pids);
    if (e2) throw e2;

    const map: Record<string, { full_name: string; contact: string | null }> = {};
    (pats || []).forEach((p) => {
      map[p.patient_id] = { full_name: p.full_name || "", contact: p.contact || null };
    });

    // 3) Merge and return
    const out = rows.map((r) => ({
      id: r.id,
      patient_id: r.patient_id,
      branch_code: r.branch_code,
      status: r.status,
      priority: r.priority,
      notes_frontdesk: r.notes_frontdesk,
      visit_date_local: r.visit_date_local,
      total_price: r.total_price,
      is_philhealth_claim: !!r.is_philhealth_claim, // <-- add
      yakap_flag: !!r.yakap_flag,                   // <-- add
      full_name: map[r.patient_id]?.full_name || "",
      contact: map[r.patient_id]?.contact || "",
    }));

    return NextResponse.json({ rows: out });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 400 });
  }
}

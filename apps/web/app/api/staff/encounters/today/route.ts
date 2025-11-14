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
    const consultOnly = url.searchParams.get("consultOnly") === "1";
    const includeDone = url.searchParams.get("includeDone") === "1"; // 👈 NEW
    if (!["SI", "SL"].includes(branch)) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    const db = supa();
    const today = todayISOin();

    // Build base query
    let q = db
      .from("encounters")
      .select(
        // kept your existing fields
        "id, patient_id, branch_code, status,  priority, notes_frontdesk, visit_date_local, total_price, is_philhealth_claim, yakap_flag, consult_status, queue_number, for_consult"
      )
      .eq("branch_code", branch)
      .eq("visit_date_local", today);

    // Ordering / filtering for consult queue
    if (consultOnly) {
      // 👇 Keep queued/in-consult. When includeDone=1, also keep done.
      const states = includeDone
        ? ["queued_for_consult", "in_consult", "done"]
        : ["queued_for_consult", "in_consult"];
      q = q.in("consult_status", states).order("queue_number", { ascending: true, nullsFirst: false });
    } else {
      q = q.order("priority", { ascending: false });
    }

    const { data: encs, error: e1 } = await q;
    if (e1) throw e1;

    const rows = encs || [];
    if (rows.length === 0) return NextResponse.json({ rows: [] });

    // Fetch patient names/contacts in one go (guard against empty array)
    const pids = Array.from(new Set(rows.map((r) => r.patient_id))).filter(Boolean);
    let pats: any[] = [];
    if (pids.length) {
      const { data: p, error: e2 } = await db
        .from("patients")
        .select("patient_id, full_name, contact")
        .in("patient_id", pids);
      if (e2) throw e2;
      pats = p || [];
    }

    const map: Record<string, { full_name: string; contact: string | null }> = {};
    pats.forEach((p) => {
      map[p.patient_id] = {
        full_name: p.full_name || "",
        contact: p.contact || null,
      };
    });

    // If consultOnly is on but some items have null queue_number,
    // do a final JS-side sort to push nulls last (defensive).
    let list = rows;
    if (consultOnly) {
      list = [...rows].sort((a: any, b: any) => {
        const an = a.queue_number ?? Number.POSITIVE_INFINITY;
        const bn = b.queue_number ?? Number.POSITIVE_INFINITY;
        return an - bn;
      });
    }

    // Shape the output
    const out = list.map((r: any) => ({
      id: r.id,
      patient_id: r.patient_id,
      branch_code: r.branch_code,

      // existing lab-flow fields (unchanged)
      status: r.status,
      priority: r.priority,
      notes_frontdesk: r.notes_frontdesk,
      visit_date_local: r.visit_date_local,
      total_price: r.total_price,
      is_philhealth_claim: !!r.is_philhealth_claim,
      yakap_flag: !!r.yakap_flag,

      // consult-queue fields
      consult_status: r.consult_status ?? null,
      queue_number: r.queue_number ?? null,
      for_consult: !!r.for_consult,

      // patient info
      full_name: map[r.patient_id]?.full_name || "",
      contact: map[r.patient_id]?.contact || "",
    }));

    return NextResponse.json({ rows: out });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 400 });
  }
}

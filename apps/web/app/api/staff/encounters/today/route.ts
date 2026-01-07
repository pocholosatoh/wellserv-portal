// app/api/staff/encounters/today/route.ts
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { readTodayEncounters, todayISOin } from "@/lib/todayEncounters";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"], requireBranch: true });
    if (!auth.ok) return auth.response;
    const url = new URL(req.url);
    const requested = (url.searchParams.get("branch") || "").toUpperCase();
    const branch =
      auth.branch === "ALL" ? (requested || "SI").toUpperCase() : (auth.branch || "SI");
    const consultOnly = url.searchParams.get("consultOnly") === "1";
    const includeDone = url.searchParams.get("includeDone") === "1"; // 👈 NEW
    const sortRaw = (url.searchParams.get("sort") || "").toLowerCase();
    const sort = sortRaw === "surname" ? "surname" : "latest";
    const view = (url.searchParams.get("view") || "").toLowerCase();
    if (!["SI", "SL"].includes(branch)) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    if (view === "quick") {
      const supabase = getSupabase();
      const today = todayISOin();
      const { data, error } = await supabase
        .from("encounters")
        .select("id, patient_id, queue_number, status, consult_status, patients(full_name)")
        .eq("visit_date_local", today)
        .eq("branch_code", branch)
        .order("queue_number", { ascending: true })
        .limit(40);
      if (error) throw error;
      const rows =
        data?.map((row: any) => ({
          encounter_id: row.id,
          patient_id: row.patient_id,
          full_name: row.patients?.full_name ?? null,
          queue_number: row.queue_number ?? null,
          status: row.status ?? null,
          consult_status: row.consult_status ?? null,
        })) ?? [];
      return NextResponse.json({ rows });
    }

    const rows = await readTodayEncounters({
      branch: branch as "SI" | "SL",
      consultOnly,
      includeDone,
      sort,
    });

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 400 });
  }
}

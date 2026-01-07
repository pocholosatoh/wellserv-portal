export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { guard } from "@/lib/auth/guard";

const MAX_IDS = 50;

type ReportRow = {
  id: string;
  external_result_id: string;
  patient_id: string;
  encounter_id: string | null;
  interpreted_at: string | null;
  doctor_id: string;
  interpreted_name: string;
  interpreted_license: string | null;
  status: string;
  rhythm: string | null;
  heart_rate: string | null;
  pr_interval: string | null;
  qrs_duration: string | null;
  qtc: string | null;
  axis: string | null;
  findings: string | null;
  impression: string;
  recommendations: string | null;
};

function parseIds(searchParams: URLSearchParams) {
  const raw = searchParams.getAll("ids");
  const set = new Set<string>();

  for (const entry of raw) {
    (entry || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((id) => {
        if (/^[0-9a-f-]{8,}$/i.test(id)) {
          set.add(id);
        }
      });
  }

  return Array.from(set).slice(0, MAX_IDS);
}

export async function GET(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor", "staff", "patient"] });
    if (!auth.ok) return auth.response;
    const actor = auth.actor;

    const url = new URL(req.url);
    const ids = parseIds(url.searchParams);
    if (ids.length === 0) {
      return NextResponse.json({ reports: [] });
    }

    const sb = supabaseAdmin();
    let query = sb
      .from("ecg_reports")
      .select(
        "id, external_result_id, patient_id, encounter_id, interpreted_at, doctor_id, interpreted_name, interpreted_license, status, rhythm, heart_rate, pr_interval, qrs_duration, qtc, axis, findings, impression, recommendations",
      )
      .in("external_result_id", ids);

    if (actor.kind === "patient") {
      query = query.eq("patient_id", actor.patient_id).eq("status", "final");
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows: ReportRow[] = Array.isArray(data) ? data : [];
    const filtered =
      actor.kind === "patient" ? rows.filter((r) => r.patient_id === actor.patient_id) : rows;

    const reports = filtered.map((r) => ({
      id: r.id,
      external_result_id: r.external_result_id,
      patient_id: r.patient_id,
      encounter_id: r.encounter_id,
      interpreted_at: r.interpreted_at,
      doctor_id: r.doctor_id,
      interpreted_name: r.interpreted_name,
      interpreted_license: r.interpreted_license,
      status: r.status,
      rhythm: r.rhythm,
      heart_rate: r.heart_rate,
      pr_interval: r.pr_interval,
      qrs_duration: r.qrs_duration,
      qtc: r.qtc,
      axis: r.axis,
      findings: r.findings,
      impression: r.impression,
      recommendations: r.recommendations,
    }));

    const res = NextResponse.json({ reports });
    res.headers.set("x-route", "ecg/reports");
    res.headers.set("x-count", String(reports.length));
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

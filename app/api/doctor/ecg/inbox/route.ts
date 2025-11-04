export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActor } from "@/lib/api-actor";

const BUCKET = process.env.NEXT_PUBLIC_PATIENT_BUCKET?.trim() || "patient-files";
const MAX_LIMIT = 100;

type RawReport = {
  id: string;
  encounter_id: string | null;
  doctor_id: string;
  interpreted_at: string | null;
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

type RawItem = {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  category?: string | null;
  subtype?: string | null;
  taken_at: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  provider: string | null;
  note: string | null;
  url: string;
  content_type: string | null;
  ecg_reports?: RawReport[] | RawReport | null;
};

function parseLimit(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizePatientId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

async function signUrl(pathOrUrl: string, sb: SupabaseClient) {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(pathOrUrl, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(
      `[sign-error] bucket="${BUCKET}" path="${pathOrUrl}" :: ${error?.message || "Failed to sign ECG strip"}`
    );
  }
  return data.signedUrl;
}

function describeReport(report: RawReport | null | undefined) {
  if (!report) return null;
  return {
    id: report.id,
    encounter_id: report.encounter_id,
    doctor_id: report.doctor_id,
    interpreted_at: report.interpreted_at,
    interpreted_name: report.interpreted_name,
    interpreted_license: report.interpreted_license,
    status: report.status,
    rhythm: report.rhythm,
    heart_rate: report.heart_rate,
    pr_interval: report.pr_interval,
    qrs_duration: report.qrs_duration,
    qtc: report.qtc,
    axis: report.axis,
    findings: report.findings,
    impression: report.impression,
    recommendations: report.recommendations,
  };
}

export async function GET(req: Request) {
  try {
    const actor = await requireActor();
    if (!actor || actor.kind !== "doctor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "pending").toLowerCase();
    const status = statusParam === "completed" ? "completed" : "pending";
    const limit = parseLimit(url.searchParams.get("limit"));
    const from = normalizeDate(url.searchParams.get("from"));
    const to = normalizeDate(url.searchParams.get("to"));
    const pid = normalizePatientId(url.searchParams.get("pid") || url.searchParams.get("patient_id"));

    const sb = supabaseAdmin();
    const ecgFilter = [
      "type.eq.ECG",
      "type.ilike.ECG%",
      "category.eq.ecg",
      "category.eq.ECG",
      "subtype.ilike.ECG%",
    ].join(",");

    let query = sb
      .from("external_results")
      .select(
        `
          id,
          patient_id,
          encounter_id,
          category,
          subtype,
          taken_at,
          uploaded_at,
          uploaded_by,
          provider,
          note,
          url,
          content_type,
          ecg_reports (
            id,
            encounter_id,
            doctor_id,
            interpreted_at,
            interpreted_name,
            interpreted_license,
            status,
            rhythm,
            heart_rate,
            pr_interval,
            qrs_duration,
            qtc,
            axis,
            findings,
            impression,
            recommendations
          )
        `
      )
      .or(ecgFilter)
      .order("taken_at", { ascending: false, nullsLast: false })
      .order("uploaded_at", { ascending: false, nullsLast: false })
      .limit(Math.min(limit * 3, MAX_LIMIT * 2));

    if (from) query = query.gte("taken_at", from);
    if (to) query = query.lte("taken_at", to);
    if (pid) query = query.eq("patient_id", pid);

    const { data, error } = await query;
    if (error) throw error;

    const rows: RawItem[] = Array.isArray(data) ? data : [];
    const filtered = rows.filter((row) => {
      const reports = row.ecg_reports;
      const hasReport = Array.isArray(reports) ? reports.length > 0 : !!reports;
      return status === "completed" ? hasReport : !hasReport;
    });

    const limited = filtered.slice(0, limit);
    const items = await Promise.all(
      limited.map(async (row) => {
        const signedUrl = await signUrl(row.url, sb);
        const rawReport = Array.isArray(row.ecg_reports) ? row.ecg_reports[0] : row.ecg_reports ?? null;
        const report = describeReport(rawReport);

        return {
          external_result_id: row.id,
          patient_id: row.patient_id,
          encounter_id: row.encounter_id,
          taken_at: row.taken_at,
          uploaded_at: row.uploaded_at,
          uploaded_by: row.uploaded_by,
          provider: row.provider,
          note: row.note,
          url: signedUrl,
          content_type: row.content_type,
          report,
        };
      })
    );

    const res = NextResponse.json({ items, status });
    res.headers.set("x-route", "doctor/ecg:inbox");
    res.headers.set("x-status", status);
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

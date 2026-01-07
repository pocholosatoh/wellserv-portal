export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getDoctorSession } from "@/lib/doctorSession";
import { guard } from "@/lib/auth/guard";

const BUCKET = process.env.NEXT_PUBLIC_PATIENT_BUCKET?.trim() || "patient-files";

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

type RawExternal = {
  id: string;
  type: string | null;
  category?: string | null;
  subtype?: string | null;
  patient_id: string;
  encounter_id: string | null;
  taken_at: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  provider: string | null;
  note: string | null;
  url: string;
  content_type: string | null;
  ecg_reports?: RawReport[] | RawReport | null;
};

type RawEncounter = {
  id: string;
  patient_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  reason?: string | null;
  purpose?: string | null;
  branch?: string | null;
  branch_code?: string | null;
  site?: string | null;
};

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

async function signUrl(pathOrUrl: string, sb: SupabaseClient) {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(pathOrUrl, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(
      `[sign-error] bucket="${BUCKET}" path="${pathOrUrl}" :: ${error?.message || "Failed to sign ECG strip"}`,
    );
  }
  return data.signedUrl;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ externalResultId: string }> },
) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const doctor = await getDoctorSession().catch(() => null);
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { externalResultId } = await context.params;
    if (!externalResultId) {
      return NextResponse.json({ error: "external_result_id is required" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: row, error } = await sb
      .from("external_results")
      .select(
        `
          id,
          type,
          category,
          subtype,
          patient_id,
          encounter_id,
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
        `,
      )
      .eq("id", externalResultId)
      .maybeSingle<RawExternal>();

    if (error) throw error;
    const typeLabel = String(row?.type || "")
      .trim()
      .toUpperCase();
    const categoryLabel = String(row?.category || "")
      .trim()
      .toUpperCase();
    const subtypeLabel = String(row?.subtype || "")
      .trim()
      .toUpperCase();
    const isEcg =
      typeLabel.startsWith("ECG") || categoryLabel === "ECG" || subtypeLabel.startsWith("ECG");

    if (!row || !isEcg) {
      return NextResponse.json({ error: "ECG strip not found" }, { status: 404 });
    }

    const signedUrl = await signUrl(row.url, sb);
    const rawReport = Array.isArray(row.ecg_reports)
      ? row.ecg_reports[0]
      : (row.ecg_reports ?? null);
    const report = describeReport(rawReport);

    const { data: encRows, error: encErr } = await sb
      .from("encounters")
      .select("id, patient_id, created_at, updated_at")
      .eq("patient_id", row.patient_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (encErr) throw encErr;

    const encounters = (encRows || []).map((enc: RawEncounter) => ({
      id: enc.id,
      patient_id: enc.patient_id,
      created_at: enc.created_at || enc.updated_at || null,
      reason: null,
      branch: null,
    }));

    return NextResponse.json({
      strip: {
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
      },
      report,
      encounters,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

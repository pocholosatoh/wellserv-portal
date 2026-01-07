import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getDoctorSession } from "@/lib/doctorSession";
import { guard } from "@/lib/auth/guard";

const Payload = z.object({
  action: z.enum(["save", "sign"]),
  heart_rate: z.string().optional().nullable(),
  rhythm: z.string().optional().nullable(),
  pr: z.string().optional().nullable(),
  qrs: z.string().optional().nullable(),
  qt: z.string().optional().nullable(),
  qtc: z.string().optional().nullable(),
  axis: z.string().optional().nullable(),
  findings: z.string().optional().nullable(),
  impression: z.string().optional().nullable(),
  recommendations: z.string().optional().nullable(),
  signature_name: z.string().optional().nullable(),
  signature_license: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ externalResultId: string }> };

type EcgCaseRow = { id: string; external_result_id?: string | null };

type DoctorSession = Awaited<ReturnType<typeof getDoctorSession>>;

function sanitize(value: unknown) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function resolveSignatureName(input: string | null, doctor: DoctorSession | null) {
  const provided = sanitize(input);
  if (provided) return provided;
  return sanitize(doctor?.display_name) || sanitize(doctor?.name) || "Physician";
}

function resolveSignatureLicense(input: string | null, doctor: DoctorSession | null) {
  const provided = sanitize(input);
  if (provided) return provided;
  return sanitize(doctor?.credentials);
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const doctor = await getDoctorSession().catch(() => null);
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { externalResultId } = await context.params;
    const trimmedExternalResultId = String(externalResultId || "").trim();
    if (!trimmedExternalResultId) {
      return NextResponse.json({ error: "Missing external result id" }, { status: 400 });
    }

    const parsed = Payload.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const body = parsed.data;
    const supa = getSupabaseServer();
    const now = new Date().toISOString();

    const { data: ecgCase, error: caseErr } = await supa
      .from("ecg_cases")
      .select("id, external_result_id")
      .eq("external_result_id", trimmedExternalResultId)
      .maybeSingle<EcgCaseRow>();

    if (caseErr) throw caseErr;
    if (!ecgCase?.id) {
      return NextResponse.json({ error: "ECG case not found" }, { status: 404 });
    }

    const signatureName = resolveSignatureName(body.signature_name ?? null, doctor);
    const signatureLicense = resolveSignatureLicense(body.signature_license ?? null, doctor);

    const { data: interpretation, error } = await supa
      .from("ecg_interpretations")
      .insert({
        ecg_case_id: ecgCase.id,
        doctor_id: doctor.doctorId,
        read_started_at: now,
        signed_at: body.action === "sign" ? now : null,
        heart_rate: sanitize(body.heart_rate),
        rhythm: sanitize(body.rhythm),
        pr: sanitize(body.pr),
        qrs: sanitize(body.qrs),
        qt: sanitize(body.qt),
        qtc: sanitize(body.qtc),
        axis: sanitize(body.axis),
        findings: sanitize(body.findings),
        impression: sanitize(body.impression),
        recommendations: sanitize(body.recommendations),
        signature_name: signatureName,
        signature_license: signatureLicense,
      })
      .select("id")
      .single();

    if (error) throw error;

    if (body.action === "sign") {
      const { error: updateExternalResultErr } = await supa
        .from("external_results")
        .update({
          category: "ecg",
          subtype: "ECG_12LEAD",
          impression: sanitize(body.impression),
          reported_at: now,
          performer_name: signatureName,
          performer_role: "Physician",
          performer_license: signatureLicense,
        })
        .eq("id", trimmedExternalResultId);

      if (updateExternalResultErr) throw updateExternalResultErr;

      await supa.from("ecg_cases").update({ status: "signed" }).eq("id", ecgCase.id);
    } else {
      await supa.from("ecg_cases").update({ status: "in_review" }).eq("id", ecgCase.id);
    }

    return NextResponse.json({ ok: true, id: interpretation.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

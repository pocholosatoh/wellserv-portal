// app/api/doctor/medical-certificates/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";
import { signDoctorSignature } from "@/lib/medicalCertificates";
import { normalizePhysicalExam, SupportingDataEntry } from "@/lib/medicalCertificateSchema";
import { guard } from "@/lib/auth/guard";

function isUuid(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const db = getSupabase();

    const cert = await db.from("medical_certificates").select("*").eq("id", id).maybeSingle();

    if (cert.error) {
      return NextResponse.json({ error: cert.error.message }, { status: 400 });
    }
    if (!cert.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // only allow the issuing doctor (if we can compare)
    if (isUuid(doctor.doctorId) && cert.data.doctor_id && cert.data.doctor_id !== doctor.doctorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supporting = await db
      .from("medical_certificate_supporting_items")
      .select("id, ordinal, source_type, source_id, label, summary, payload")
      .eq("certificate_id", cert.data.id)
      .order("ordinal", { ascending: true });

    if (supporting.error) {
      return NextResponse.json({ error: supporting.error.message }, { status: 400 });
    }

    const doctorSnapshot = cert.data.doctor_snapshot ? { ...cert.data.doctor_snapshot } : null;
    if (doctorSnapshot?.signature_image_url) {
      doctorSnapshot.signed_signature_url = await signDoctorSignature(
        db,
        doctorSnapshot.signature_image_url,
      );
    }

    return NextResponse.json({
      certificate: {
        ...cert.data,
        doctor_snapshot: doctorSnapshot,
      },
      supporting_items: supporting.data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

function normalizeSupportingData(list: any): SupportingDataEntry[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry: any) => {
      if (!entry || typeof entry !== "object") return null;
      const label = (entry.label || "").toString().trim();
      const summary = (entry.summary || "").toString().trim();
      if (!label || !summary) return null;
      return {
        type: (entry.type || "custom").toString(),
        label,
        summary,
        source_id: entry.source_id ? String(entry.source_id) : null,
        payload: entry.payload && typeof entry.payload === "object" ? entry.payload : null,
      } as SupportingDataEntry;
    })
    .filter(Boolean) as SupportingDataEntry[];
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const db = getSupabase();

    const existing = await db.from("medical_certificates").select("*").eq("id", id).maybeSingle();
    if (existing.error) {
      return NextResponse.json({ error: existing.error.message }, { status: 400 });
    }
    if (!existing.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.data.doctor_id && doctor.doctorId !== existing.data.doctor_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const physicalExam = normalizePhysicalExam(body.physical_exam);
    const supportingData = normalizeSupportingData(body.supporting_data);

    const updatePayload = {
      diagnosis_text:
        body.diagnosis_text ?? body.diagnosisText ?? existing.data.diagnosis_text ?? null,
      remarks: body.remarks ?? existing.data.remarks ?? null,
      advice: body.advice ?? existing.data.advice ?? null,
      findings_summary: body.findings_summary ?? existing.data.findings_summary ?? null,
      physical_exam: physicalExam,
      supporting_data: supportingData,
      updated_at: new Date().toISOString(),
    };

    const updated = await db
      .from("medical_certificates")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updated.error || !updated.data) {
      return NextResponse.json(
        { error: updated.error?.message || "Update failed" },
        { status: 400 },
      );
    }

    await db.from("medical_certificate_supporting_items").delete().eq("certificate_id", id);

    if (supportingData.length) {
      const detailRows = supportingData.map((entry, idx) => ({
        certificate_id: id,
        ordinal: idx,
        source_type: entry.type,
        source_id: entry.source_id || null,
        label: entry.label,
        summary: entry.summary,
        payload: entry.payload || null,
      }));
      await db.from("medical_certificate_supporting_items").insert(detailRows);
    }

    return NextResponse.json({ certificate: updated.data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

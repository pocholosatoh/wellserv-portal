export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { guard } from "@/lib/auth/guard";
import crypto from "crypto";

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseDataUrlPng(dataUrl?: string | null): { buf: Buffer; ext: string } | null {
  if (!dataUrl) return null;
  const m = /^data:image\/(png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  return { buf: Buffer.from(m[2], "base64"), ext: m[1] };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;
    const actor = auth.actor;
    if (actor.kind !== "doctor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = supaAdmin();

    const body = await req.json().catch(() => ({}));

    const consultation_id = String(body?.consultation_id || "").trim();
    const encounter_id = String(body?.encounter_id || "").trim();
    const patient_id = String(body?.patient_id || "").trim();

    const template_slug = String(body?.template_slug || "yakap-consent").trim();
    const template_version = Number(body?.template_version || 1);

    const doctor_attest = !!body?.doctor_attest;
    const use_stored_doctor_signature = !!body?.use_stored_doctor_signature;

    const doctor_signature_data_url = String(body?.doctor_signature_data_url || "");
    const patient_method = String(body?.patient_method || "drawn").toLowerCase() as
      | "drawn"
      | "typed";
    const patient_signature_data_url = String(body?.patient_signature_data_url || "");
    const patient_typed_name = body?.patient_typed_name
      ? String(body.patient_typed_name).trim()
      : null;

    if (!consultation_id || !encounter_id || !patient_id) {
      return NextResponse.json(
        { error: "consultation_id, encounter_id, patient_id are required." },
        { status: 400 },
      );
    }
    if (!doctor_attest) {
      return NextResponse.json({ error: "Doctor attestation is required." }, { status: 400 });
    }
    if (patient_method === "drawn" && !patient_signature_data_url) {
      return NextResponse.json(
        { error: "Patient signature (drawn) is required." },
        { status: 400 },
      );
    }
    if (patient_method === "typed" && !patient_typed_name) {
      return NextResponse.json({ error: "Patient typed name is required." }, { status: 400 });
    }

    // Resolve doctor & stored signature (if any)
    const { data: doc } = await db
      .from("doctors")
      .select("doctor_id, signature_image_url")
      .eq("doctor_id", actor.id)
      .maybeSingle();

    const doctor_id: string = doc?.doctor_id || actor.id;

    // Prepare upload paths (relative to bucket "consents")
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    // NOTE: we store paths relative to the bucket (no extra "private/" prefixing)
    const basePath = `private/signatures/${y}/${m}/${encounter_id}`;

    const signer_kind = (body?.signer_kind || "patient") as
      | "patient"
      | "guardian"
      | "representative";
    const signer_name = body?.signer_name ? String(body.signer_name).trim() : null;
    const signer_relation = body?.signer_relation ? String(body.signer_relation).trim() : null;

    if (signer_kind !== "patient" && (!signer_name || !signer_relation)) {
      return NextResponse.json(
        { error: "Signer name and relation are required." },
        { status: 400 },
      );
    }

    // --- Doctor signature ---
    let doctor_signature_url: string | null = null;

    if (use_stored_doctor_signature) {
      if (!doc?.signature_image_url) {
        return NextResponse.json(
          { error: "No stored doctor signature on file. Please draw your signature." },
          { status: 400 },
        );
      }
      // Use stored path as-is (assume it already points to a valid bucket/path)
      doctor_signature_url = doc.signature_image_url;
    } else if (doctor_signature_data_url) {
      const parsed = parseDataUrlPng(doctor_signature_data_url);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid doctor signature image." }, { status: 400 });
      }
      const fname = `${basePath}/doctor-${doctor_id}.png`; // relative to bucket
      const put = await db.storage.from("consents").upload(fname, parsed.buf, {
        contentType: "image/png",
        upsert: true,
      });
      if (put.error) {
        return NextResponse.json({ error: put.error.message }, { status: 500 });
      }
      doctor_signature_url = fname; // store the relative path ONLY
    }

    // --- Patient signature (if drawn) ---
    let patient_signature_url: string | null = null;
    if (patient_method === "drawn" && patient_signature_data_url) {
      const parsed = parseDataUrlPng(patient_signature_data_url);
      if (!parsed)
        return NextResponse.json({ error: "Invalid patient signature image." }, { status: 400 });
      const fname = `${basePath}/patient-${patient_id}.png`; // relative to bucket
      const put = await db.storage.from("consents").upload(fname, parsed.buf, {
        contentType: "image/png",
        upsert: true,
      });
      if (put.error) return NextResponse.json({ error: put.error.message }, { status: 500 });
      patient_signature_url = fname; // store the relative path ONLY
    }

    // Compute consent hash (stable order of fields)
    const hashPayload = JSON.stringify({
      encounter_id,
      consultation_id,
      patient_id,
      doctor_id,
      template_slug,
      template_version,
      doctor_attest,
      patient_method,
      patient_typed_name: patient_typed_name || null,
      doctor_signature_url: doctor_signature_url || null,
      patient_signature_url: patient_signature_url || null,
      signer_kind,
      signer_name,
      signer_relation,
    });
    const consent_hash = `sha256:${crypto.createHash("sha256").update(hashPayload).digest("hex")}`;

    // Insert consent
    const ins = await db
      .from("patient_consents")
      .insert({
        encounter_id,
        consultation_id,
        patient_id,
        doctor_id,
        template_slug,
        template_version,
        doctor_attest,
        doctor_signature_url,
        patient_method,
        patient_signature_url,
        patient_typed_name,
        consent_hash,
        created_by: doctor_id,
        signer_kind,
        signer_name,
        signer_relation,
      })
      .select("id")
      .single();

    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });

    return NextResponse.json({ ok: true, consent_id: ins.data.id, consent_hash });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

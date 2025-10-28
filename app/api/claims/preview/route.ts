export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// ---- Facility header constants for the XML exporter
const FACILITY = {
  kpp_code: process.env.KPP_CODE || "03-000000", // <- set in .env
  facility_name: process.env.FACILITY_NAME || "WELLSERV Medical Corporation",
  privacy_declaration:
    process.env.PH_PRIVACY_DECL ||
    "This system, WellServ Portal, complies with the Data Privacy Act of 2012 (RA 10173). All patient records transmitted electronically to PhilHealth are encrypted and accessed only by authorized personnel.",
};

export async function GET(req: Request) {
  try {
    const sb = getSupabase();
    const { searchParams } = new URL(req.url);
    const encounterId = (searchParams.get("encounter_id") || "").trim();
    const consultationId = (searchParams.get("consultation_id") || "").trim();

    let useEncounterId = encounterId;

    // If encounter_id not given but consultation_id is, resolve it → encounter_id
    if (!useEncounterId && consultationId) {
      const { data: c, error: e1 } = await sb
        .from("consultations")
        .select("id, encounter_id")
        .eq("id", consultationId)
        .maybeSingle();
      if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
      if (!c) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
      if (!c.encounter_id) {
        return NextResponse.json(
          { error: "This consultation is not linked to an encounter" },
          { status: 404 }
        );
      }
      useEncounterId = c.encounter_id;
    }

    if (!useEncounterId) {
      return NextResponse.json({ error: "Provide encounter_id or consultation_id" }, { status: 400 });
    }

    // --- Load encounter core
    const { data: enc, error: eEnc } = await sb
      .from("encounters")
      .select(
        "id, patient_id, branch_code, visit_date_local, status, is_philhealth_claim, yakap_flag"
      )
      .eq("id", useEncounterId)
      .maybeSingle();

    if (eEnc) return NextResponse.json({ error: eEnc.message }, { status: 500 });
    if (!enc) return NextResponse.json({ error: "Encounter not found" }, { status: 404 });

    // patient
    const { data: p } = await sb
      .from("patients")
      .select("patient_id, full_name, sex, birthday, address, contact")
      .eq("patient_id", enc.patient_id)
      .maybeSingle();

    // consultation for this encounter (latest by visit_at)
    const { data: cons } = await sb
      .from("consultations")
      .select(
        "id, patient_id, visit_at, type, status, doctor_id, doctor_name_at_time, branch, signing_doctor_id, signing_doctor_name, signing_doctor_prc_no, signing_doctor_philhealth_md_id"
      )
      .eq("encounter_id", enc.id)
      .order("visit_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // diagnoses under that consultation
    let diags: any[] = [];
    if (cons?.id) {
      const { data: d } = await sb
        .from("consultation_diagnoses")
        .select(
          "id, icd10_code, icd10_text_snapshot, is_primary, certainty, acuity, onset_date, resolved_date, notes"
        )
        .eq("consultation_id", cons.id)
        .order("is_primary", { ascending: false });
      diags = d || [];
    }

    // latest signed Rx under that consultation (if any)
    let rx: any = null;
    if (cons?.id) {
      const { data: r } = await sb
        .from("prescriptions")
        .select("id, status, doctor_id, created_at, updated_at")
        .eq("consultation_id", cons.id)
        .eq("status", "signed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (r?.id) {
        const { data: items } = await sb
          .from("prescription_items")
          .select(
            "generic_name, brand_name, strength, form, route, dose_amount, dose_unit, frequency_code, duration_days, quantity, instructions"
          )
          .eq("prescription_id", r.id)
          .order("created_at", { ascending: true });
        rx = { ...r, items: items || [] };
      }
    }

    // signer snapshot for display / eligibility hint (prefer consultation snapshot)
    let signer: any = null;
    if (cons?.signing_doctor_id || cons?.signing_doctor_name) {
      signer = {
        doctor_id: cons?.signing_doctor_id || null,
        name: cons?.signing_doctor_name || null,
        credentials: null,
        prc_no: cons?.signing_doctor_prc_no || null,
        philhealth_md_id: cons?.signing_doctor_philhealth_md_id || null,
      };
      if (!signer.name && cons?.signing_doctor_id) {
        const { data: doc } = await sb
          .from("doctors")
          .select("display_name, credentials, prc_no, philhealth_md_id")
          .eq("doctor_id", cons.signing_doctor_id)
          .maybeSingle();
        if (doc) {
          signer.name = doc.display_name || null;
          signer.credentials = doc.credentials || null;
          signer.prc_no = doc.prc_no || signer.prc_no;
          signer.philhealth_md_id = doc.philhealth_md_id || signer.philhealth_md_id;
        }
      }
    }

    // ---- NEW: latest consent for this encounter (to satisfy YAKAP/eKAS signatures)
    let consent: any = null;
    {
      const { data: cRow } = await sb
        .from("patient_consents")
        .select(
          "id, encounter_id, consultation_id, patient_id, doctor_id, template_slug, template_version, doctor_attest, patient_method, doctor_signature_url, patient_signature_url, patient_typed_name, consent_hash, created_at, signer_kind, signer_name, signer_relation"
        )
        .eq("encounter_id", enc.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cRow) {
        // Provider info (for convenience in exporter)
        let provider: any = null;
        if (cRow.doctor_id) {
          const { data: doc } = await sb
            .from("doctors")
            .select("doctor_id, display_name, credentials, prc_no, philhealth_md_id")
            .eq("doctor_id", cRow.doctor_id)
            .maybeSingle();
          if (doc) {
            provider = {
              doctor_id: doc.doctor_id,
              name: doc.display_name || null,
              credentials: doc.credentials || null,
              prc_no: doc.prc_no || null,
              philhealth_md_id: doc.philhealth_md_id || null,
            };
          }
        }

        // Template body for <consent_text>
        let template: any = null;
        const { data: tpl } = await sb
          .from("consent_templates")
          .select("slug, version, body")
          .eq("slug", cRow.template_slug)
          .eq("version", cRow.template_version)
          .maybeSingle();
        if (tpl) template = tpl;

        consent = { ...cRow, provider, template }; // include template.body
      }
    }

    const flags = {
      has_consent: !!consent?.id,
      has_signed_rx: !!rx?.id,
      is_yakap: !!enc.yakap_flag || !!enc.is_philhealth_claim,
    };

    // Ship facility header alongside the claim preview to simplify XML export
    const header = {
      facility: {
        kpp_code: FACILITY.kpp_code,
        facility_name: FACILITY.facility_name,
      },
      privacy_declaration: FACILITY.privacy_declaration,
      // exporter can add encoder/encoding_date at write time
    };

    return NextResponse.json({
      header,            // <- NEW (for XML header)
      encounter: enc,
      patient: p || null,
      consultation: cons || null,
      diagnoses: diags,
      prescription: rx,
      signer,
      consent,           // <- NEW (signatures, signer_kind, template.body, hash, timestamp)
      flags,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

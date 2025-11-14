// app/api/prescriptions/sign/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireActor } from "@/lib/api-actor";
import { computeValidUntil, DEFAULT_RX_VALID_DAYS, parseValidDays } from "@/lib/rx";

function isUuid(v?: string | null) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: NextRequest) {
  try {
    const db = getSupabase();

    // 1) Auth
    const actor = await requireActor().catch(() => null);
    if (!actor || actor.kind !== "doctor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const doctorId = isUuid(actor.id) ? (actor.id as string) : null;

    // 2) Inputs
    const body = await req.json().catch(() => ({}));
    let prescriptionId = String(body?.prescription_id || body?.prescriptionId || "").trim();
    let consultationId = String(body?.consultation_id || body?.consultationId || "").trim();
    const requestedValidDays = parseValidDays(body?.valid_days ?? body?.validDays);
    let existingValidDays: number | null = null;

    // NEW: allow signing by prescription_id alone (resolve its consultation_id)
    if (!consultationId && prescriptionId) {
      const q = await db
        .from("prescriptions")
        .select("id, consultation_id, status, valid_days")
        .eq("id", prescriptionId)
        .maybeSingle();
      if (q.error) return NextResponse.json({ error: q.error.message }, { status: 500 });
      if (!q.data?.id) {
        return NextResponse.json({ error: "Prescription not found." }, { status: 404 });
      }
      consultationId = q.data.consultation_id as string;
      existingValidDays = parseValidDays(q.data.valid_days);
      // also require it's a draft if they passed a specific id
      if (q.data.status !== "draft") {
        return NextResponse.json(
          { error: "Only draft prescriptions can be signed. Create a Revision first." },
          { status: 409 }
        );
      }
    }

    if (!consultationId && !prescriptionId) {
      return NextResponse.json(
        { error: "consultation_id or prescription_id is required." },
        { status: 400 }
      );
    }

    // 3) Load signer profile to snapshot
    let signerDoctorId: string | null = doctorId;
    let signerName: string | null = actor.display_name || actor.name || null;
    let signerPRC: string | null = null;
    let signerPHIC: string | null = actor.philhealth_md_id || null;

    if (doctorId) {
      const docRes = await db
        .from("doctors")
        .select("id, full_name, prc_no, philhealth_md_id")
        .eq("id", doctorId)
        .maybeSingle();

      if (docRes.error) {
        return NextResponse.json({ error: docRes.error.message }, { status: 500 });
      }

      if (docRes.data) {
        signerDoctorId = docRes.data.id ?? signerDoctorId;
        signerName = docRes.data.full_name || signerName;
        signerPRC = docRes.data.prc_no || null;
        signerPHIC = docRes.data.philhealth_md_id || signerPHIC;
      }
    }

    // 4) Resolve which Rx to sign if id not provided -> pick most recent draft
    if (!prescriptionId) {
      const latestDraft = await db
        .from("prescriptions")
        .select("id, valid_days")
        .eq("consultation_id", consultationId)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestDraft.error) {
        return NextResponse.json({ error: latestDraft.error.message }, { status: 500 });
      }
      if (!latestDraft.data?.id) {
        // No draft — check active signed
        const alreadySigned = await db
          .from("prescriptions")
          .select("id")
          .eq("consultation_id", consultationId)
          .eq("status", "signed")
          .eq("active", true)
          .limit(1);

        if (alreadySigned.error) {
          return NextResponse.json({ error: alreadySigned.error.message }, { status: 500 });
        }
        if ((alreadySigned.data || []).length > 0) {
          return NextResponse.json(
            { error: "Prescription already signed for this consultation. Create a Revision first." },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: "No draft found to sign. Add items and Save Draft first." },
          { status: 409 }
        );
      }
      prescriptionId = latestDraft.data.id as string;
      existingValidDays = parseValidDays(latestDraft.data.valid_days);
    } else {
      // Sanity: ensure the provided draft belongs to the same consultation
      const chk = await db
        .from("prescriptions")
        .select("consultation_id, status, valid_days")
        .eq("id", prescriptionId)
        .maybeSingle();
      if (chk.error) return NextResponse.json({ error: chk.error.message }, { status: 500 });
      if (!chk.data?.consultation_id || chk.data.consultation_id !== consultationId) {
        return NextResponse.json(
          { error: "Prescription not found for this consultation." },
          { status: 404 }
        );
      }
      existingValidDays = parseValidDays(chk.data.valid_days);
      if (chk.data.status !== "draft") {
        return NextResponse.json(
          { error: "Only draft prescriptions can be signed. Create a Revision first." },
          { status: 409 }
        );
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const finalValidDays = requestedValidDays ?? existingValidDays ?? DEFAULT_RX_VALID_DAYS;
    const validUntilIso = computeValidUntil(finalValidDays, now).toISOString();

    // 5) Deactivate previous signed (one active signed only)
    const prevSigned = await db
      .from("prescriptions")
      .select("id")
      .eq("consultation_id", consultationId)
      .eq("status", "signed")
      .eq("active", true);

    if (prevSigned.error) {
      return NextResponse.json({ error: prevSigned.error.message }, { status: 500 });
    }
    const prevIds = (prevSigned.data || []).map((r: any) => r.id);
    if (prevIds.length) {
      const sup = await db
        .from("prescriptions")
        .update({ active: false, is_superseded: true, updated_at: nowIso })
        .in("id", prevIds);
      if (sup.error) return NextResponse.json({ error: sup.error.message }, { status: 500 });
    }

    // 6) Sign draft
    const signPayload: any = {
      status: "signed",
      active: true,
      doctor_id: signerDoctorId ?? null,
      updated_at: nowIso,
      valid_days: finalValidDays,
      valid_until: validUntilIso,
    };
    const sign = await db.from("prescriptions").update(signPayload).eq("id", prescriptionId);
    if (sign.error) return NextResponse.json({ error: sign.error.message }, { status: 500 });

    // 7) Mark consultation done + snapshot signer
    const updCon = await db
      .from("consultations")
      .update({
        // status: "done",
        signing_doctor_id: signerDoctorId,
        signing_doctor_name: signerName,
        signing_doctor_prc_no: signerPRC,
        signing_doctor_philhealth_md_id: signerPHIC,
        updated_at: nowIso,
      })
      .eq("id", consultationId)
      .select("encounter_id")
      .maybeSingle();

    if (updCon.error) return NextResponse.json({ error: updCon.error.message }, { status: 500 });

    const encounterId = updCon.data?.encounter_id || null;

    // 8) Encounter guard (don’t force intake -> done)
    if (encounterId) {
      const cur = await db.from("encounters").select("status").eq("id", encounterId).maybeSingle();
      const currentStatus = cur.data?.status as string | undefined;
      const allowedToFinish = new Set(["for-processing", "for-extract", "done"]);

      if (currentStatus && allowedToFinish.has(currentStatus)) {
        await db
          .from("encounters")
          .update({
            consult_status: "done",
            status: "done",
            updated_at: nowIso,
          })
          .eq("id", encounterId);
      } else {
        await db
          .from("encounters")
          .update({
            consult_status: "done",
            updated_at: nowIso,
          })
          .eq("id", encounterId);
      }
    }

    // 9) Response for panel & claims preview
    const claimEligible = !!signerPHIC;
    const claimBlockReason = claimEligible
      ? null
      : "Signer lacks PhilHealth MD ID (reliever or incomplete doctor profile).";

    return NextResponse.json({
      id: prescriptionId,
      status: "signed",
      signer: {
        doctor_id: signerDoctorId,
        name: signerName,
        prc_no: signerPRC,
        philhealth_md_id: signerPHIC,
      },
      claim_eligible: claimEligible,
      claim_block_reason: claimBlockReason,
      valid_days: finalValidDays,
      valid_until: validUntilIso,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";
import { auditActionForRequest, logAuditEvent } from "@/lib/audit/logAuditEvent";
import { buildReferralPayload, formatAffiliationSnapshot } from "@/lib/referrals";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function isUuid(value?: string | null) {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function normalizePatientId(value?: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeOptionalText(value: any, maxLen = 2000) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return raw.length > maxLen ? raw.slice(0, maxLen) : raw;
}

function toBool(value: any): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDoctorDisplay(fullName?: string | null, credentials?: string | null) {
  const base = String(fullName || "").trim();
  const cred = String(credentials || "").trim();
  if (!base) return null;
  if (cred && !new RegExp(`,\\s*${escapeRegExp(cred)}$`).test(base)) {
    return `${base}, ${cred}`;
  }
  return base;
}

export async function POST(req: Request) {
  try {
    const auth = await guard(req, {
      allow: ["doctor", "staff"],
      requireBranch: true,
      requirePatientId: true,
    });
    if (!auth.ok) return auth.response;

    const ip = getRequestIp(req);
    const auditCtx = (() => {
      try {
        const route = new URL(req.url).pathname;
        const method = req.method || "POST";
        const action = auditActionForRequest(route, method);
        return { route, method, action };
      } catch {
        return null;
      }
    })();
    const rateKey = `doctor:referrals:generate:${ip}`;
    const limited = await checkRateLimit({ key: rateKey, limit: 12, windowMs: 60 * 1000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const actor = auth.actor;
    if (actor.kind !== "doctor") {
      return NextResponse.json({ error: "Doctor role required" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));

    const patientId = normalizePatientId(auth.patientId || body?.patient_id || body?.patientId);
    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const consultId = String(body?.consult_id || body?.consultation_id || "").trim() || null;
    let encounterId = String(body?.encounter_id || "").trim() || null;
    const referredToSpecialtyId = String(body?.referred_to_specialty_id || "").trim();
    const referredToDoctorId = String(body?.referred_to_doctor_id || "").trim();
    const legacyAffiliationId = String(body?.referred_to_affiliation_id || "").trim() || null;
    const affiliationIdsRaw = Array.isArray(body?.affiliation_ids) ? body.affiliation_ids : [];
    const requestedAffiliationIds = affiliationIdsRaw
      .map((value: any) => String(value || "").trim())
      .filter(Boolean);

    if (!referredToSpecialtyId || !isUuid(referredToSpecialtyId)) {
      return NextResponse.json({ error: "referred_to_specialty_id is required" }, { status: 400 });
    }
    if (!referredToDoctorId || !isUuid(referredToDoctorId)) {
      return NextResponse.json({ error: "referred_to_doctor_id is required" }, { status: 400 });
    }
    if (consultId && !isUuid(consultId)) {
      return NextResponse.json({ error: "consult_id is invalid" }, { status: 400 });
    }
    if (encounterId && !isUuid(encounterId)) {
      return NextResponse.json({ error: "encounter_id is invalid" }, { status: 400 });
    }
    if (legacyAffiliationId && !isUuid(legacyAffiliationId)) {
      return NextResponse.json(
        { error: "referred_to_affiliation_id is invalid" },
        { status: 400 },
      );
    }

    const uniqueAffiliationIds = Array.from(
      new Set(
        requestedAffiliationIds.length
          ? requestedAffiliationIds
          : legacyAffiliationId
            ? [legacyAffiliationId]
            : [],
      ),
    ).filter(Boolean) as string[];

    if (uniqueAffiliationIds.some((id) => !isUuid(id))) {
      return NextResponse.json({ error: "affiliation_ids is invalid" }, { status: 400 });
    }

    const includeLatestNotes = toBool(body?.include_latest_notes);
    const includeLatestLabs = toBool(body?.include_latest_labs);
    const includeLatestVitals = toBool(body?.include_latest_vitals);
    const includePatientHistory = toBool(body?.include_patient_history);
    const notes = normalizeOptionalText(body?.notes ?? null);

    const db = getSupabase();

    const patientRes = await db
      .from("patients")
      .select("patient_id")
      .eq("patient_id", patientId)
      .maybeSingle();

    if (patientRes.error) {
      return NextResponse.json({ error: patientRes.error.message }, { status: 400 });
    }
    if (!patientRes.data) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (consultId) {
      const consultRes = await db
        .from("consultations")
        .select("id, patient_id, encounter_id, branch")
        .eq("id", consultId)
        .maybeSingle();
      if (consultRes.error) {
        return NextResponse.json({ error: consultRes.error.message }, { status: 400 });
      }
      if (!consultRes.data) {
        return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
      }
      if (consultRes.data.patient_id !== patientId) {
        return NextResponse.json({ error: "Consultation does not match patient" }, { status: 400 });
      }
      if (auth.branch && consultRes.data.branch && consultRes.data.branch !== auth.branch) {
        return NextResponse.json({ error: "Branch mismatch" }, { status: 403 });
      }
      if (consultRes.data.encounter_id && !encounterId) {
        encounterId = consultRes.data.encounter_id;
      }
    }

    if (encounterId) {
      const encounterRes = await db
        .from("encounters")
        .select("id, patient_id, branch_code")
        .eq("id", encounterId)
        .maybeSingle();
      if (encounterRes.error) {
        return NextResponse.json({ error: encounterRes.error.message }, { status: 400 });
      }
      if (!encounterRes.data) {
        return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
      }
      if (encounterRes.data.patient_id !== patientId) {
        return NextResponse.json({ error: "Encounter does not match patient" }, { status: 400 });
      }
      if (auth.branch && encounterRes.data.branch_code && encounterRes.data.branch_code !== auth.branch) {
        return NextResponse.json({ error: "Branch mismatch" }, { status: 403 });
      }
    }

    const specialtyRes = await db
      .from("referral_specialties")
      .select("id, code, name, is_active")
      .eq("id", referredToSpecialtyId)
      .maybeSingle();

    if (specialtyRes.error) {
      return NextResponse.json({ error: specialtyRes.error.message }, { status: 400 });
    }
    if (!specialtyRes.data || !specialtyRes.data.is_active) {
      return NextResponse.json({ error: "Specialty not available" }, { status: 400 });
    }

    const doctorRes = await db
      .from("referral_doctors")
      .select("id, full_name, credentials, prc_no, specialty_id, is_active")
      .eq("id", referredToDoctorId)
      .maybeSingle();

    if (doctorRes.error) {
      return NextResponse.json({ error: doctorRes.error.message }, { status: 400 });
    }
    if (!doctorRes.data || !doctorRes.data.is_active) {
      return NextResponse.json({ error: "Specialist not available" }, { status: 400 });
    }
    if (doctorRes.data.specialty_id !== specialtyRes.data.id) {
      return NextResponse.json({ error: "Specialist does not match specialty" }, { status: 400 });
    }

    if (uniqueAffiliationIds.length === 0) {
      const affCount = await db
        .from("referral_doctor_affiliations")
        .select("id", { count: "exact", head: true })
        .eq("referral_doctor_id", doctorRes.data.id)
        .eq("is_active", true);

      if (affCount.error) {
        return NextResponse.json({ error: affCount.error.message }, { status: 400 });
      }
      if ((affCount.count ?? 0) > 0) {
        return NextResponse.json({ error: "Select at least one affiliation" }, { status: 400 });
      }
    }

    const affiliationSnapshots: Array<{
      id: string;
      sort_order: number | null;
      snapshot_text: string;
    }> = [];

    if (uniqueAffiliationIds.length) {
      const affRes = await db
        .from("referral_doctor_affiliations")
        .select(
          "id, referral_doctor_id, institution_name, address_line, contact_numbers, schedule_text, sort_order, is_active",
        )
        .in("id", uniqueAffiliationIds)
        .eq("referral_doctor_id", doctorRes.data.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("institution_name", { ascending: true });

      if (affRes.error) {
        return NextResponse.json({ error: affRes.error.message }, { status: 400 });
      }

      const rows = affRes.data ?? [];
      const validIds = new Set(rows.map((row) => row.id));
      const invalid = uniqueAffiliationIds.filter((id) => !validIds.has(id));
      if (invalid.length) {
        return NextResponse.json({ error: "Affiliation does not match doctor" }, { status: 400 });
      }

      rows.forEach((row) => {
        const snapshot =
          formatAffiliationSnapshot({
            institution_name: row.institution_name,
            address_line: row.address_line,
            contact_numbers: row.contact_numbers,
            schedule_text: row.schedule_text,
          }) ?? "";
        affiliationSnapshots.push({
          id: row.id,
          sort_order: row.sort_order ?? null,
          snapshot_text: snapshot,
        });
      });
    }

    const primaryAffiliationId = uniqueAffiliationIds[0] ?? null;
    const combinedAffiliationSnapshot =
      affiliationSnapshots.length > 0
        ? affiliationSnapshots.map((snap) => snap.snapshot_text).join("\n\n")
        : null;

    const fallbackDoctorId = process.env.FALLBACK_DOCTOR_UUID || ZERO_UUID;
    const actorId = isUuid(actor.id) ? actor.id : fallbackDoctorId;

    const insertRes = await db
      .from("patient_referrals")
      .insert({
        patient_id: patientId,
        consult_id: consultId,
        encounter_id: encounterId,
        referred_by_doctor_id: actorId,
        referred_to_doctor_id: referredToDoctorId,
        referred_to_specialty_id: referredToSpecialtyId,
        referred_to_affiliation_id: primaryAffiliationId,
        include_latest_notes: includeLatestNotes,
        include_latest_labs: includeLatestLabs,
        include_latest_vitals: includeLatestVitals,
        include_patient_history: includePatientHistory,
        snapshot_affiliation_text: combinedAffiliationSnapshot,
        notes,
      })
      .select("id, referral_code, created_at")
      .maybeSingle();

    if (insertRes.error || !insertRes.data) {
      return NextResponse.json(
        { error: insertRes.error?.message || "Failed to create referral" },
        { status: 400 },
      );
    }

    const referralId = insertRes.data.id;

    if (affiliationSnapshots.length > 0) {
      const affInsert = await db.from("patient_referral_affiliations").insert(
        affiliationSnapshots.map((snap) => ({
          referral_id: referralId,
          referral_doctor_affiliation_id: snap.id,
          sort_order: snap.sort_order ?? 0,
          snapshot_text: snap.snapshot_text,
        })),
      );
      if (affInsert.error) {
        console.error("referral_affiliations_insert_failed", {
          referral_id: referralId,
          affiliation_count: affiliationSnapshots.length,
        });
      }
    }

    const doctorDisplay = formatDoctorDisplay(doctorRes.data.full_name, doctorRes.data.credentials);
    const specialtyLabel = specialtyRes.data.name || specialtyRes.data.code || "Specialty";
    const eventText = `Referral form generated to Dr. ${doctorDisplay || "Specialist"} (${specialtyLabel})`;

    if (consultId) {
      const eventRes = await db.from("consultation_events").insert({
        consultation_id: consultId,
        patient_id: patientId,
        event_type: "referral_generated",
        event_text: eventText,
        referral_id: referralId,
        created_by_doctor_id: actorId,
      });

      if (eventRes.error) {
        console.error("referral_event_insert_failed", {
          referral_id: referralId,
          consult_id: consultId,
        });
      }
    }

    const payload = await buildReferralPayload(referralId);
    if (!payload) {
      return NextResponse.json(
        { error: "Referral created but failed to load payload" },
        { status: 500 },
      );
    }

    if (auditCtx) {
      void logAuditEvent({
        actor_role: "doctor",
        actor_id: actorId,
        actor_user_id: null,
        patient_id: patientId,
        branch_id: auth.branch ?? null,
        route: auditCtx.route,
        method: auditCtx.method,
        action: auditCtx.action,
        result: "ALLOW",
        status_code: 201,
        ip: ip && ip !== "unknown" ? ip : null,
        user_agent: req.headers.get("user-agent") || null,
        meta: {
          event: "referral.generate",
          referral_id: referralId,
          source: "api",
        },
      });
    }

    return NextResponse.json({ ok: true, referral: payload }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

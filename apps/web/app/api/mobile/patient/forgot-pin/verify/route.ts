export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

const RequestSchema = z.object({
  patient_id: z.string().min(1),
  contact: z.string().min(1),
  birthday: z.string().min(1),
});

function normalizePatientId(raw: unknown) {
  return String(raw ?? "").trim().toUpperCase();
}

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

function normalizeContact(raw: unknown) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const hasPlus = value.startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (!digits) return value.toLowerCase();
  return hasPlus ? `+${digits}` : digits;
}

function normalizeBirthday(raw: unknown) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return value;
}

const GENERIC_ERROR = "Unable to verify details.";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse({
      patient_id: body?.patient_id ?? body?.patientId,
      contact: body?.contact ?? body?.phone,
      birthday: body?.birthday ?? body?.birthdate,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const patient_id = normalizePatientId(parsed.data.patient_id);
    const contact = normalizeContact(parsed.data.contact);
    const birthday = normalizeBirthday(parsed.data.birthday);

    if (!patient_id || !contact || !birthday) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const supa = getSupabase();
    const pattern = escapeLikeExact(patient_id);
    const { data: patient, error } = await supa
      .from("patients")
      .select("patient_id, contact, birthday")
      .ilike("patient_id", pattern)
      .maybeSingle();

    if (error) throw error;
    if (!patient) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const storedContact = normalizeContact(patient.contact);
    const storedBirthday = normalizeBirthday(patient.birthday);

    if (storedContact !== contact || storedBirthday !== birthday) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const canonicalId = normalizePatientId(patient.patient_id || patient_id);
    const now = new Date();

    const { data: existing } = await supa
      .from("patient_pin_reset_tokens")
      .select("id, token, expires_at, attempt_count, used_at")
      .eq("patient_id", canonicalId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.expires_at && new Date(existing.expires_at) > now) {
      const attempts = Number(existing.attempt_count ?? 0);
      if (attempts >= 3) {
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 429 });
      }
      await supa
        .from("patient_pin_reset_tokens")
        .update({ attempt_count: attempts + 1 })
        .eq("id", existing.id);
      return NextResponse.json({ ok: true, token: existing.token });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supa.from("patient_pin_reset_tokens").insert({
      patient_id: canonicalId,
      token,
      expires_at: expiresAt,
      attempt_count: 1,
    });

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, token });
  } catch (err: any) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
}

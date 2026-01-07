export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashPin } from "@/lib/auth/pinHash";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

const RequestSchema = z.object({
  patient_id: z.string().min(1),
  token: z.string().min(1),
  new_pin: z.string().min(1),
});

function normalizePatientId(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function isTrivialPin(pin: string) {
  return [
    "0000",
    "1111",
    "1234",
    "2222",
    "3333",
    "4444",
    "5555",
    "6666",
    "7777",
    "8888",
    "9999",
  ].includes(pin);
}

const GENERIC_ERROR = "Unable to reset PIN. Please try again.";

export async function POST(req: Request) {
  try {
    const ip = getRequestIp(req);
    const key = `public:mobile-forgot-pin-reset:${ip}`;
    const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
    if (!limited.ok) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse({
      patient_id: body?.patient_id ?? body?.patientId,
      token: body?.token,
      new_pin: body?.new_pin ?? body?.newPin,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const patient_id = normalizePatientId(parsed.data.patient_id);
    const token = String(parsed.data.token || "").trim();
    const newPin = String(parsed.data.new_pin || "").trim();

    if (!patient_id || !token || !newPin) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    if (!/^[0-9]{4}$/.test(newPin)) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    if (isTrivialPin(newPin)) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const supa = getSupabase();
    const { data: tokenRow, error } = await supa
      .from("patient_pin_reset_tokens")
      .select("id, patient_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error) throw error;
    if (!tokenRow) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const now = new Date();
    if (tokenRow.used_at || !tokenRow.expires_at || new Date(tokenRow.expires_at) <= now) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const canonicalId = normalizePatientId(tokenRow.patient_id);
    if (canonicalId !== patient_id) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const hashed = await hashPin(newPin);
    const { error: updateError } = await supa
      .from("patients")
      .update({ pin_hash: hashed, pin_set_at: new Date().toISOString() })
      .eq("patient_id", canonicalId);

    if (updateError) throw updateError;

    await supa
      .from("patient_pin_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
}

// app/api/mobile/patient/set-pin/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashPin } from "@/lib/auth/pinHash";

const RequestSchema = z.object({
  patient_id: z.string().min(1),
  general_access_code: z.string().min(1),
  pin: z.string().min(1),
  confirmPin: z.string().min(1),
});

function normalizePatientId(raw: unknown) {
  return String(raw ?? "").trim().toUpperCase();
}

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

function getGeneralAccessCode() {
  return (
    process.env.EXPO_PUBLIC_PATIENT_ACCESS_CODE ||
    process.env.PATIENT_PORTAL_ACCESS_CODE ||
    process.env.PATIENT_ACCESS_CODE ||
    ""
  );
}

function isTrivialPin(pin: string) {
  return ["0000", "1111", "1234", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999"].includes(pin);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse({
      patient_id: body?.patient_id ?? body?.patientId,
      general_access_code:
        body?.general_access_code ??
        body?.generalAccessCode ??
        body?.access_code ??
        body?.accessCode,
      pin: body?.pin,
      confirmPin: body?.confirmPin ?? body?.confirm_pin,
    });

    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const patient_id = normalizePatientId(parsed.data.patient_id);
    const providedAccessCode = String(parsed.data.general_access_code || "").trim();

    const expected = getGeneralAccessCode();
    if (!expected) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }
    if (providedAccessCode !== expected) {
      return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
    }

    if (!patient_id) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const supa = getSupabase();
    const pidPattern = escapeLikeExact(patient_id);
    const { data: patient, error } = await supa
      .from("patients")
      .select("patient_id, pin_hash")
      .ilike("patient_id", pidPattern)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!patient) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }
    if (patient.pin_hash) {
      return NextResponse.json(
        { error: "PIN already set. Please log in instead." },
        { status: 409 }
      );
    }

    const pin = String(parsed.data.pin || "").trim();
    const confirmPin = String(parsed.data.confirmPin || "").trim();

    if (pin !== confirmPin) {
      return NextResponse.json({ error: "PINs do not match." }, { status: 400 });
    }
    if (!/^[0-9]{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }
    if (isTrivialPin(pin)) {
      return NextResponse.json({ error: "Please choose a less obvious PIN." }, { status: 400 });
    }

    const hashed = await hashPin(pin);
    const { error: updateError } = await supa
      .from("patients")
      .update({ pin_hash: hashed, pin_set_at: new Date().toISOString() })
      .eq("patient_id", patient.patient_id || patient_id)
      .is("pin_hash", null);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      ok: true,
      message: "PIN set successfully. You can now log in with your patient ID and PIN.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unable to set PIN" },
      { status: 400 }
    );
  }
}

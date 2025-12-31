// app/api/mobile/patient/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/auth/pinHash";
import { setSession } from "@/lib/session";
import { signMobileToken } from "@/lib/mobileAuth";

const RequestSchema = z.object({
  patient_id: z.string().min(1),
  pin: z.string().optional(),
});

function normalizePatientId(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse({
      patient_id: body?.patient_id ?? body?.patientId,
      pin: body?.pin,
    });

    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const patient_id = normalizePatientId(parsed.data.patient_id);
    if (!patient_id) {
      return NextResponse.json({ error: "Patient ID is required." }, { status: 400 });
    }

    const supa = getSupabase();
    const pattern = escapeLikeExact(patient_id);
    const { data: patient, error } = await supa
      .from("patients")
      .select("patient_id, full_name, sex, birthday, pin_hash")
      .ilike("patient_id", pattern)
      .maybeSingle();

    if (error) throw error;
    if (!patient) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    const canonicalId = normalizePatientId(patient.patient_id || patient_id);

    if (!patient.pin_hash) {
      return NextResponse.json(
        { ok: false, code: "PIN_REQUIRED", message: "You must set up a PIN before logging in." },
        { status: 403 },
      );
    }

    const pin = String(parsed.data.pin || "").trim();
    if (!pin) {
      return NextResponse.json({ error: "Please log in with your PIN." }, { status: 400 });
    }
    if (!/^[0-9]{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }

    const ok = await verifyPin(pin, String(patient.pin_hash || ""));
    if (!ok) {
      return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
    }

    await supa
      .from("patients")
      .update({ last_login_at: new Date().toISOString() })
      .eq("patient_id", canonicalId);

    const token = await signMobileToken(canonicalId);
    const res = NextResponse.json({
      ok: true,
      token,
      patient: {
        patient_id: canonicalId,
        full_name: patient.full_name,
        sex: patient.sex,
        birthday: patient.birthday,
      },
    });
    console.log("[mobile] login token issued", !!token);

    setSession(res, {
      role: "patient",
      patient_id: canonicalId,
      persist: true,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Login failed" }, { status: 400 });
  }
}

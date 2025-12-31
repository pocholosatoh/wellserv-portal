// app/api/auth/patient/login/route.ts
import { NextResponse } from "next/server";
import { setSession } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

type PatientRow = {
  patient_id?: string | null;
  full_name?: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // accept either env name; prefer SERVICE_ROLE if present
  process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export const dynamic = "force-dynamic";

function normalizePatientId(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function escapeLikeExact(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}

async function findPatientRecord(pid: string, signal?: AbortSignal): Promise<PatientRow | null> {
  const pattern = escapeLikeExact(pid);

  // First, look at the canonical patients table (exact, index-friendly match).
  const patientQuery = supabase
    .from("patients")
    .select("patient_id, full_name")
    .eq("patient_id", pid)
    .limit(1);
  const { data: patient, error: patientError } = await (
    signal ? patientQuery.abortSignal(signal) : patientQuery
  ).maybeSingle();

  if (patientError) throw patientError;
  if (patient) return patient;

  // Back-compat: rarely, patient IDs might have arrived in a different case.
  const patientCiQuery = supabase
    .from("patients")
    .select("patient_id, full_name")
    .ilike("patient_id", pattern)
    .limit(1);
  const { data: patientCi, error: patientCiError } = await (
    signal ? patientCiQuery.abortSignal(signal) : patientCiQuery
  ).maybeSingle();

  if (patientCiError) throw patientCiError;
  if (patientCi) return patientCi;

  // Fallback: older records might exist only in results_wide.
  const visitQuery = supabase
    .from("results_wide")
    .select("patient_id")
    .eq("patient_id", pid)
    .order("date_of_test", { ascending: false })
    .limit(1);
  const { data: visitRow, error: visitError } = await (
    signal ? visitQuery.abortSignal(signal) : visitQuery
  ).maybeSingle();

  if (visitError) throw visitError;
  if (visitRow) {
    return {
      patient_id: visitRow.patient_id ?? pid,
      full_name: null,
    };
  }

  // Fallback #2: case-insensitive check on the legacy table as a last resort.
  const legacyVisitQuery = supabase
    .from("results_wide")
    .select("patient_id")
    .ilike("patient_id", pattern)
    .order("date_of_test", { ascending: false })
    .limit(1);
  const { data: legacyVisitRow, error: legacyVisitError } = await (
    signal ? legacyVisitQuery.abortSignal(signal) : legacyVisitQuery
  ).maybeSingle();

  if (legacyVisitError) throw legacyVisitError;
  if (legacyVisitRow) {
    return {
      patient_id: legacyVisitRow.patient_id ?? pid,
      full_name: null,
    };
  }

  return null;
}

export async function POST(req: Request) {
  const controller = new AbortController();
  let timeout: NodeJS.Timeout | null = null;
  try {
    const { patient_id: rawPid, access_code, remember } = await req.json();

    if (!rawPid || !access_code) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const normalized = normalizePatientId(rawPid);
    if (!normalized) {
      return NextResponse.json({ error: "Missing Patient ID" }, { status: 400 });
    }

    const expected = process.env.PATIENT_PORTAL_ACCESS_CODE;
    if (!expected) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }
    if (access_code !== expected) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }

    // Normalize to uppercase (your DB stores uppercase pids)
    const target = normalized;

    // Hard timeout so the client doesn't spin forever.
    timeout = setTimeout(() => controller.abort(), 8000);

    // Look up patient record (patients table first, then results_wide as fallback)
    const row = await findPatientRecord(target, controller.signal);

    if (!row) {
      return NextResponse.json({ error: "No matching Patient ID" }, { status: 404 });
    }

    const canonicalId = normalizePatientId(row.patient_id || target);

    // Create response and set session cookies
    const res = NextResponse.json({ ok: true });
    setSession(res, {
      role: "patient",
      patient_id: canonicalId,
      persist: !!remember,
    });
    return res;
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Login timed out, please try again." : e?.message || "Login failed" },
      { status: aborted ? 504 : 400 },
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

import { NextResponse } from "next/server";
import { buildAllReports } from "@/lib/api/patient-results-core";
import { guard } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await guard(req, { allow: ["staff"], requirePatientId: true });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const patient_id = String(auth.patientId || "").trim().toUpperCase();
  const visitDate = (searchParams.get("date") ?? undefined) || undefined;
  const limit = searchParams.get("limit");

  const json = await buildAllReports(
    patient_id,
    limit != null ? Number(limit) : undefined,
    visitDate,
  );
  return NextResponse.json(json, { status: 200 });
}

export async function POST(req: Request) {
  const auth = await guard(req, { allow: ["staff"], requirePatientId: true });
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const patient_id = String(auth.patientId || "").trim().toUpperCase();
  const visitDate = body?.visitDate ? String(body.visitDate) : undefined;
  const limit = body?.limit != null ? Number(body.limit) : undefined;

  const json = await buildAllReports(patient_id, limit, visitDate);
  return NextResponse.json(json, { status: 200 });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildAllReports } from "@/lib/api/patient-results-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "staff")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patient_id = String(searchParams.get("patient_id") || "")
    .trim()
    .toUpperCase();
  const visitDate = (searchParams.get("date") ?? undefined) || undefined;
  const limit = searchParams.get("limit");
  if (!patient_id) return NextResponse.json({ error: "patient_id is required" }, { status: 400 });

  const json = await buildAllReports(
    patient_id,
    limit != null ? Number(limit) : undefined,
    visitDate,
  );
  return NextResponse.json(json, { status: 200 });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "staff")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patient_id = String(body?.patient_id || "")
    .trim()
    .toUpperCase();
  const visitDate = body?.visitDate ? String(body.visitDate) : undefined;
  const limit = body?.limit != null ? Number(body.limit) : undefined;
  if (!patient_id) return NextResponse.json({ error: "patient_id is required" }, { status: 400 });

  const json = await buildAllReports(patient_id, limit, visitDate);
  return NextResponse.json(json, { status: 200 });
}

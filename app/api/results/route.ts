// app/api/results/route.ts
import { NextResponse } from "next/server";
import { readResults } from "@/lib/sheets";

export const dynamic = "force-dynamic";

async function getRows(patientId?: string) {
  const all = await readResults();
  if (!patientId) return all;
  const pid = patientId.trim().toLowerCase();
  return all.filter(r => (r["patient_id"] || "").trim().toLowerCase() === pid);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const patient_id = searchParams.get("patient_id") || "";
  const rows = await getRows(patient_id || undefined);
  return NextResponse.json({ count: rows.length, rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rows = await getRows(body?.patient_id);
  return NextResponse.json({ count: rows.length, rows });
}

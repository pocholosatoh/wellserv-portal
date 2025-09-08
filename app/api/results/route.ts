import { NextResponse } from "next/server";
import { readRows } from "@/lib/sheets"; // make sure this path matches your tsconfig path alias

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") ?? undefined;

  const rows = await readRows();
  const filtered = patientId ? rows.filter(r => r.patientId === patientId) : rows;

  return NextResponse.json({ count: filtered.length, rows: filtered });
}

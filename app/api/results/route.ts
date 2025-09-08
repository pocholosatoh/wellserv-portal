import { NextResponse } from "next/server";
import { readResults } from "@/lib/sheets"; // ⟵ change this

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const patient_id = searchParams.get("patient_id") ?? "";
  const all = await readResults(); // ⟵ and this
  const rows = patient_id ? all.filter(r => (r["patient_id"] || "").toLowerCase() === patient_id.toLowerCase()) : all;
  return NextResponse.json({ count: rows.length, rows });
}

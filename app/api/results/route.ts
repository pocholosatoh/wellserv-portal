// app/api/results/route.ts
import { NextResponse } from "next/server";
import { readResults } from "@/lib/sheets";

export const dynamic = "force-dynamic";

async function safeHash(s: string) {
  try {
    const buf = new TextEncoder().encode(s);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
  } catch {
    return "hasherr";
  }
}

async function getRows(patientId?: string) {
  const all = await readResults();
  if (!patientId) return all;
  const pid = patientId.trim().toLowerCase();
  return all.filter(r => (r["patient_id"] || "").trim().toLowerCase() === pid);
}

export async function GET(req: Request) {
  const __start = Date.now();
  const { searchParams } = new URL(req.url);
  const patient_id = searchParams.get("patient_id") || "";

  try {
    const rows = await getRows(patient_id || undefined);

    try {
      const pid = patient_id ? await safeHash(patient_id) : "none";
      console.log("[api:results] ok %s %d row(s) in %dms", pid, rows.length, Date.now() - __start);
    } catch {}

    return NextResponse.json({ count: rows.length, rows });
  } catch (e: any) {
    try {
      const pid = patient_id ? await safeHash(patient_id) : "none";
      console.log("[api:results] fail %s in %dms", pid, Date.now() - __start);
    } catch {}
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const __start = Date.now();
  const body = await req.json().catch(() => ({}));
  const patient_id = body?.patient_id as string | undefined;

  try {
    const rows = await getRows(patient_id);
    try {
      const pid = patient_id ? await safeHash(patient_id) : "none";
      console.log("[api:results] ok POST %s %d row(s) in %dms", pid, rows.length, Date.now() - __start);
    } catch {}
    return NextResponse.json({ count: rows.length, rows });
  } catch (e: any) {
    try {
      const pid = patient_id ? await safeHash(patient_id) : "none";
      console.log("[api:results] fail POST %s in %dms", pid, Date.now() - __start);
    } catch {}
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

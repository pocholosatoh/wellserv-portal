import { NextResponse } from "next/server";
import {
  readResults, readRanges, readConfig,
  buildRangeMap, filterByPatientId, filterByDate, buildReportForRow
} from "@/lib/sheets";

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

export async function GET(req: Request) {
  const __start = Date.now();
  const { searchParams } = new URL(req.url);
  const patient_id = searchParams.get("patient_id") || "";
  const date = searchParams.get("date") || "";

  if (!patient_id) {
    try { console.log("[api:report] missing patient_id in %dms", Date.now() - __start); } catch {}
    return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });
  }

  try {
    const [results, ranges, config] = await Promise.all([readResults(), readRanges(), readConfig()]);
    const rmap = buildRangeMap(ranges);
    const rows = filterByDate(filterByPatientId(results, patient_id), date);
    const reports = rows.map(r => buildReportForRow(r, rmap));

    try {
      const pid = await safeHash(patient_id);
      console.log("[api:report] ok %s %d report(s) in %dms", pid, reports.length, Date.now() - __start);
    } catch {}

    return NextResponse.json({ count: reports.length, reports, config });
  } catch (e: any) {
    try {
      const pid = patient_id ? await safeHash(patient_id) : "none";
      console.log("[api:report] fail %s in %dms", pid, Date.now() - __start);
    } catch {}
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

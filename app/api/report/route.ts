// app/api/report/route.ts
import { NextResponse } from "next/server";
import { readResults, readRanges, readConfig, buildRangeMap, filterByPatientId, filterByDate, buildReportForRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const patient_id = searchParams.get("patient_id") || "";
    const date = searchParams.get("date") || "";

    if (!patient_id) {
      return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });
    }

    const [results, ranges, config] = await Promise.all([readResults(), readRanges(), readConfig()]);
    const rmap = buildRangeMap(ranges);
    const rows = filterByDate(filterByPatientId(results, patient_id), date);

    if (rows.length === 0) {
      return NextResponse.json({ count: 0, reports: [], config });
    }

    const reports = rows.map(r => buildReportForRow(r, rmap));
    return NextResponse.json({ count: reports.length, reports, config });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

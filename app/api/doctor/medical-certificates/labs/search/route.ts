// app/api/doctor/medical-certificates/labs/search/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getDoctorSession } from "@/lib/doctorSession";
import {
  buildLabRangeMap,
  deriveLabFlag,
  formatLabEntrySummary,
  normalizeLabKey,
} from "@/lib/medicalCertificateLabs";

const DATE_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: process.env.APP_TZ || "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

function formatDate(iso?: string | null) {
  if (!iso) return "recent";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return DATE_FMT.format(dt);
}

export async function GET(req: Request) {
  try {
    const doctor = await getDoctorSession();
    if (!doctor?.doctorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const patientId = (url.searchParams.get("patient_id") || "").trim().toUpperCase();
    const query = (url.searchParams.get("q") || "").trim();
    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }
    if (query.length < 2) {
      return NextResponse.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
    }

    const db = getSupabase();
    const qEsc = query.replace(/[%_]/g, (m) => `\\${m}`);
    const ilike = `%${qEsc}%`;

    const rangeMatches = await db
      .from("ranges")
      .select("analyte_key,label")
      .ilike("label", ilike)
      .limit(50);

    if (rangeMatches.error) {
      return NextResponse.json({ error: rangeMatches.error.message }, { status: 400 });
    }

    const matchedKeys = new Set<string>(
      (rangeMatches.data || [])
        .map((row: any) => (row.analyte_key ? String(row.analyte_key).trim() : null))
        .filter(Boolean) as string[]
    );

    const orClauses = [
      `notes.ilike.${ilike}`,
      `analyte_key.ilike.${ilike}`,
      `barcode.ilike.${ilike}`,
    ];
    if (matchedKeys.size > 0) {
      const values = Array.from(matchedKeys)
        .map((v) => v.replace(/"/g, '\\"').replace(/,/g, "\\,"))
        .map((v) => `"${v}"`)
        .join(",");
      orClauses.push(`analyte_key.in.(${values})`);
    }

    const { data, error } = await db
      .from("results_flat")
      .select("*")
      .eq("patient_id", patientId)
      .or(orClauses.join(","))
      .order("date_of_test", { ascending: false })
      .limit(40);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rangeMap = await buildLabRangeMap(db);
    const labs = (data || [])
      .map((row: any, idx: number) => {
        const flag = deriveLabFlag(row, rangeMap);
        const summary = formatLabEntrySummary(row, flag, rangeMap);
        if (!summary) return null;
        const iso = row.date_of_test || null;
        const key = normalizeLabKey(row);
        const label =
          (key ? rangeMap.get(key)?.label : null) ||
          row.analyte_key ||
          row.barcode ||
          row.notes ||
          "Lab";
        return {
          id: `${iso || "na"}-${idx}`,
          date_iso: iso,
          display_date: formatDate(iso),
          label,
          summary,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ labs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

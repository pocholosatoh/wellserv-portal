// app/api/_debug/range/route.ts
import { NextResponse } from "next/server";
import { getSheets, normalizeRange } from "@/lib/google";
import { ENV } from "@/lib/env";

export async function GET() {
  const finalRange = normalizeRange(ENV.SHEET_RANGE); // ← the exact range used
  try {
    const sheets = await getSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: ENV.SHEET_ID,
      range: finalRange,
      majorDimension: "ROWS",
    });
    const firstRow = resp.data.values?.[0] || null;
    return NextResponse.json({
      ok: true,
      sheetId: ENV.SHEET_ID,
      range: finalRange,
      firstRow,
      rows: resp.data.values?.length ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, sheetId: ENV.SHEET_ID, range: finalRange, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

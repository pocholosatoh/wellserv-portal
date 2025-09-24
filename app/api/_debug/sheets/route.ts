// app/api/_debug/sheets/route.ts
import { NextResponse } from "next/server";
import { getSheets } from "@/lib/google";
import { ENV } from "@/lib/env";

export async function GET() {
  try {
    const sheets = await getSheets();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: ENV.SHEET_ID });
    const titles =
      meta.data.sheets?.map(s => s.properties?.title || "(untitled)") || [];
    return NextResponse.json({ sheetId: ENV.SHEET_ID, tabs: titles });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to list sheets" },
      { status: 500 }
    );
  }
}

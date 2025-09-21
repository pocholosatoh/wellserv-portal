// app/api/rmt/hema/import/route.ts
import { NextResponse } from "next/server";
import { sanitizeHemaRows, updateHemaToDatabase } from "@/lib/hema";

export const dynamic = "force-dynamic";

const KEY_TO_SHEET: Record<string, string> = {
  si: process.env.SI_RUNNING_SHEET_ID || "",
  sl: process.env.SL_RUNNING_SHEET_ID || "",
};

export async function POST(req: Request) {
  try {
    // simple header secret
    const secret = (process.env.RMT_UPLOAD_SECRET || "").trim();
    const auth = req.headers.get("x-rmt-secret") || "";
    if (!secret || auth !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const sheetKey = String(body?.sheetKey || "").trim().toLowerCase(); // "si" | "sl"
    const rawRows = Array.isArray(body?.rows) ? body.rows : [];

    const sheetId = KEY_TO_SHEET[sheetKey];
    if (!sheetId) return NextResponse.json({ error: "Invalid sheetKey" }, { status: 400 });
    if (!rawRows.length) return NextResponse.json({ error: "No rows to import" }, { status: 400 });

    const clean = sanitizeHemaRows(rawRows);
    if (!clean.length) return NextResponse.json({ error: "No valid rows (missing patient_id?)" }, { status: 400 });

    const result = await updateHemaToDatabase(sheetId, clean);
    return NextResponse.json({ ok: true, sheetKey, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

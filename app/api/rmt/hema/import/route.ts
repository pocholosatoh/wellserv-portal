import { NextResponse } from "next/server";
import { sanitizeHemaRows, updateHemaToDatabase } from "@/lib/hema";
import { sheetIdFor } from "@/lib/branches";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const secret = (process.env.RMT_UPLOAD_SECRET || "").trim();
    const auth = req.headers.get("x-rmt-secret") || "";
    if (!secret || auth !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const sheetKey = String(body?.sheetKey || "").trim().toLowerCase(); // e.g., "si"
    const rawRows = Array.isArray(body?.rows) ? body.rows : [];

    const sheetId = sheetIdFor(sheetKey);
    if (!sheetId) return NextResponse.json({ error: "Invalid or unconfigured sheetKey" }, { status: 400 });
    if (!rawRows.length) return NextResponse.json({ error: "No rows to import" }, { status: 400 });

    const clean = sanitizeHemaRows(rawRows);
    if (!clean.length) return NextResponse.json({ error: "No valid rows (missing patient_id?)" }, { status: 400 });

    const result = await updateHemaToDatabase(sheetId, clean);
    return NextResponse.json({ ok: true, sheetKey, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
// ===============================
// REPLACE the entire file: app/api/config/route.ts
// (This file must contain ONLY TypeScript for the API route — no CSS.)
// ===============================
import { NextResponse } from "next/server";
import { readConfig } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cfg = await readConfig();
    return NextResponse.json({ config: cfg });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
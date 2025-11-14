// app/api/consultations/finish/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST() {
  // Hard deprecate this path to avoid a third “finish” route.
  return NextResponse.json(
    {
      error:
        "Deprecated endpoint. Use /api/prescriptions/sign (finish WITH Rx) or /api/doctor/consultations/finalize (finish WITHOUT Rx).",
    },
    { status: 410 }
  );
}

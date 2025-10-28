// app/api/doctor/whoami/route.ts
import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/doctorSession";

export async function GET() {
  const sess = await getDoctorSession();
  if (!sess) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, session: sess });
}

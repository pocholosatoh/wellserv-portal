// app/api/doctor/whoami/route.ts
import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/doctorSession";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
  if (!auth.ok) return auth.response;

  const sess = await getDoctorSession();
  if (!sess) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, session: sess });
}

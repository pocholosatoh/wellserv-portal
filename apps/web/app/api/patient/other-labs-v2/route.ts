export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { fetchOtherLabsForPatient, getOtherLabsBucket, getOtherLabsExpiry } from "@/lib/otherLabs";

const BUCKET = getOtherLabsBucket();

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const auth = await guard(req, { allow: ["patient", "staff", "doctor"], requirePatientId: true });
    if (!auth.ok) return auth.response;

    const patient_id = String(auth.patientId || "").trim().toUpperCase();
    const expiresIn = getOtherLabsExpiry(url.searchParams);
    const items = await fetchOtherLabsForPatient(patient_id, { expiresIn, bucket: BUCKET });

    const res = NextResponse.json(items);
    res.headers.set("x-route-version", "patient/other-labs-v2:signed");
    res.headers.set("x-bucket", BUCKET);
    return res;
  } catch (e: any) {
    const r = NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
    r.headers.set("x-route-version", "patient/other-labs-v2:signed");
    r.headers.set("x-bucket", BUCKET);
    return r;
  }
}

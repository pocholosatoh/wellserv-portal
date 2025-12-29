export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireActor, getTargetPatientId } from "@/lib/api-actor";
import {
  fetchOtherLabsForPatient,
  getOtherLabsBucket,
  getOtherLabsExpiry,
} from "@/lib/otherLabs";

const BUCKET = getOtherLabsBucket();

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const actor = await requireActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pidRaw = getTargetPatientId(actor, { searchParams: url.searchParams });
    if (!pidRaw) return NextResponse.json({ error: "patient_id query param required" }, { status: 400 });

    const patient_id = String(pidRaw).trim().toUpperCase();
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

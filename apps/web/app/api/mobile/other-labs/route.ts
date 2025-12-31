import { NextResponse } from "next/server";
import { fetchOtherLabsForPatient, getOtherLabsBucket, getOtherLabsExpiry } from "@/lib/otherLabs";
import { getMobilePatient } from "@/lib/mobileAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const endpoint = "/api/mobile/other-labs";
  try {
    const actor = await getMobilePatient(req);
    if (!actor?.patient_id) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const url = new URL(req.url);
    const patientId = String(actor.patient_id).trim().toUpperCase();
    const bucket = getOtherLabsBucket();
    const expiresIn = getOtherLabsExpiry(url.searchParams);

    const items = await fetchOtherLabsForPatient(patientId, { expiresIn, bucket });

    const res = NextResponse.json(items);
    res.headers.set("x-route-version", "mobile/other-labs:signed");
    res.headers.set("x-bucket", bucket);
    res.headers.set("x-endpoint", endpoint);
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

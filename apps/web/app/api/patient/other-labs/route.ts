export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActor, getTargetPatientId } from "@/lib/api-actor";

const BUCKET = "patient-files"; // <-- MUST match your private bucket exactly

function getExpiry(sp: URLSearchParams) {
  const n = Number(sp.get("expires"));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 60 * 60 * 4) : 1800; // 30m default, cap 4h
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    const actor = await requireActor();
    if (!actor) {
      const r = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      r.headers.set("x-route-version", "patient/other-labs:v2-signed");
      r.headers.set("x-bucket", BUCKET);
      return r;
    }

    const patientId = getTargetPatientId(actor, { searchParams: url.searchParams });
    if (!patientId) {
      const r = NextResponse.json({ error: "patient_id query param required" }, { status: 400 });
      r.headers.set("x-route-version", "patient/other-labs:v2-signed");
      r.headers.set("x-bucket", BUCKET);
      return r;
    }

    const pid = String(patientId).trim().toUpperCase();
    const expiresIn = getExpiry(url.searchParams);

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("external_results")
      .select(
        "id, patient_id, url, content_type, type, provider, taken_at, uploaded_at, uploaded_by, note, category, subtype, impression, reported_at, performer_name, performer_role, performer_license",
      )
      .eq("patient_id", pid)
      .order("type", { ascending: true })
      .order("taken_at", { ascending: false })
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    const rows = data ?? [];

    // Sign every non-http(s) URL (they are storage paths)
    const items = await Promise.all(
      rows.map(async (r) => {
        if (/^https?:\/\//i.test(r.url)) return r; // legacy/public URL
        const { data: signed, error: signErr } = await sb.storage
          .from(BUCKET)
          .createSignedUrl(r.url, expiresIn);
        if (signErr || !signed?.signedUrl) {
          throw new Error(
            `[sign-error] bucket="${BUCKET}" path="${r.url}" expires=${expiresIn} :: ${signErr?.message || "Failed to create signed URL"}`,
          );
        }
        return { ...r, url: signed.signedUrl };
      }),
    );

    if (debug) {
      const r = NextResponse.json({
        debug: { bucket: BUCKET, count: items.length, expiresIn },
        items,
      });
      r.headers.set("x-route-version", "patient/other-labs:v2-signed");
      r.headers.set("x-bucket", BUCKET);
      return r;
    }

    const r = NextResponse.json(items);
    r.headers.set("x-route-version", "patient/other-labs:v2-signed");
    r.headers.set("x-bucket", BUCKET);
    return r;
  } catch (e: any) {
    const r = NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
    r.headers.set("x-route-version", "patient/other-labs:v2-signed");
    r.headers.set("x-bucket", BUCKET);
    return r;
  }
}

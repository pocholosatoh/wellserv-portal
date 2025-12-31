export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";

const BUCKET = process.env.NEXT_PUBLIC_PATIENT_BUCKET?.trim() || "patient-files";

function toUpperId(s: string | null | undefined) {
  return (s || "").trim().toUpperCase();
}
function getExpiry(sp: URLSearchParams) {
  const n = Number(sp.get("expires"));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 60 * 60 * 4) : 1800;
}

export async function GET(req: Request) {
  try {
    const s = await getSession();
    if (!s || s.role !== "staff") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const pid = toUpperId(url.searchParams.get("patient_id"));
    if (!pid) return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    const expiresIn = getExpiry(url.searchParams);

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("external_results")
      .select(
        "id, patient_id, url, content_type, type, provider, taken_at, uploaded_at, uploaded_by, note",
      )
      .eq("patient_id", pid)
      .order("type", { ascending: true })
      .order("taken_at", { ascending: false })
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    const rows = data ?? [];

    const items = await Promise.all(
      rows.map(async (r) => {
        if (/^https?:\/\//i.test(r.url)) return r;
        const { data: sgn, error: se } = await sb.storage
          .from(BUCKET)
          .createSignedUrl(r.url, expiresIn);
        if (se || !sgn?.signedUrl)
          throw new Error(
            `[sign-error] bucket="${BUCKET}" path="${r.url}" :: ${se?.message || "cannot sign"}`,
          );
        return { ...r, url: sgn.signedUrl };
      }),
    );

    const res = NextResponse.json(items);
    res.headers.set("x-route", "staff/other-labs:get");
    res.headers.set("x-bucket", BUCKET);
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

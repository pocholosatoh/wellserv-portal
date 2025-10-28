// app/api/staff/other-labs/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { getDoctorSession } from "@/lib/doctorSession";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */
function slugSafe(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-");
}
function toUpperId(s: string | null | undefined) {
  return (s || "").trim().toUpperCase();
}

/* ---------------- GET: list other-labs for a patient (staff only) ---------------- */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "staff") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = toUpperId(searchParams.get("patient_id"));
  if (!patientId) {
    return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("external_results")
    .select(
      "id, patient_id, url, content_type, type, provider, taken_at, uploaded_at, uploaded_by, note"
    )
    .eq("patient_id", patientId)
    .order("type", { ascending: true })
    .order("taken_at", { ascending: false })
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/* ---------------- POST: upload other-labs ----------------
   Auth:
   - If header x-rmt-secret matches env RMT_UPLOAD_SECRET → allow (RMT device)
   - Else require a staff session; uploaded_by will note the staff initials if available
---------------------------------------------------------------- */
export async function POST(req: Request) {
  // Check RMT secret first (existing flow)
  const secret = req.headers.get("x-rmt-secret");
  const allowBySecret =
    !!process.env.RMT_UPLOAD_SECRET && secret === process.env.RMT_UPLOAD_SECRET;

  // If not secret, require staff session
  let staffTag: string | null = null;
  if (!allowBySecret) {
    const s = await getSession();
    if (!s || s.role !== "staff") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Use staff initials from session; fallback to "staff"
    staffTag = (s.staff_initials && s.staff_initials.trim()) || "staff";
  }

  try {
    const form = await req.formData();
    const rawPid = String(form.get("patient_id") || "").trim();
    const patient_id = toUpperId(rawPid);
    const provider = (form.get("provider") as string) || null;
    const taken_at = (form.get("taken_at") as string) || null; // YYYY-MM-DD
    const note = (form.get("note") as string) || null;
    const files = form.getAll("files").filter(Boolean) as File[];

    if (!patient_id) return NextResponse.json({ error: "patient_id required" }, { status: 400 });
    if (!files.length) return NextResponse.json({ error: "no files" }, { status: 400 });

    const sb = supabaseAdmin();
    const bucket = process.env.NEXT_PUBLIC_EXTERNAL_RESULTS_BUCKET || "external-results";
    const out: any[] = [];

    for (const file of files) {
      const dateFolder =
        taken_at && /^\d{4}-\d{2}-\d{2}$/.test(taken_at)
          ? taken_at
          : new Date().toISOString().slice(0, 10);

      const uuid =
        (globalThis as any).crypto?.randomUUID?.() ||
        Math.random().toString(36).slice(2);

      const safeName = `${uuid}-${slugSafe(file.name || "file")}`;
      const path = `${patient_id}/${dateFolder}/${safeName}`;

      const buf = await file.arrayBuffer();
      const contentType =
        file.type ||
        (safeName.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/octet-stream");

      const up = await sb.storage
        .from(bucket)
        .upload(path, buf, { contentType, upsert: false });
      if (up.error) throw up.error;

      const pub = sb.storage.from(bucket).getPublicUrl(path);
      const url = pub.data.publicUrl;

      const { data: inserted, error: insErr } = await sb
        .from("external_results")
        .insert({
          patient_id,
          provider,
          taken_at: taken_at ? new Date(taken_at).toISOString().slice(0, 10) : null,
          uploaded_by: allowBySecret ? "rmt" : staffTag || "staff",
          note,
          url,
          content_type: contentType,
        })
        .select()
        .single();

      if (insErr) throw insErr;
      out.push(inserted);
    }

    return NextResponse.json({ uploaded: out.length, items: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

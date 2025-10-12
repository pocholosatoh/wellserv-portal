// app/api/staff/other-labs/upload/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugSafe(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-");
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-rmt-secret");
    if (!process.env.RMT_UPLOAD_SECRET || secret !== process.env.RMT_UPLOAD_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const patient_id = String(form.get("patient_id") || "").trim();
    const provider   = (form.get("provider") as string) || null;
    const taken_at   = (form.get("taken_at") as string) || null; // YYYY-MM-DD
    const note       = (form.get("note") as string) || null;
    const files      = form.getAll("files").filter(Boolean) as File[];

    if (!patient_id) return NextResponse.json({ error: "patient_id required" }, { status: 400 });
    if (!files.length) return NextResponse.json({ error: "no files" }, { status: 400 });

    const sb = supabaseAdmin();
    const bucket = process.env.NEXT_PUBLIC_EXTERNAL_RESULTS_BUCKET || "external-results";
    const out: any[] = [];

    for (const file of files) {
      const dateFolder = taken_at && /^\d{4}-\d{2}-\d{2}$/.test(taken_at)
        ? taken_at
        : new Date().toISOString().slice(0,10);
      const uuid = (globalThis as any).crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      const safeName = `${uuid}-${slugSafe(file.name || "file")}`;
      const path = `${patient_id}/${dateFolder}/${safeName}`;

      const buf = await file.arrayBuffer();
      const contentType = file.type || (safeName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      const up = await sb.storage.from(bucket).upload(path, buf, { contentType, upsert: false });
      if (up.error) throw up.error;

      const pub = sb.storage.from(bucket).getPublicUrl(path);
      const url = pub.data.publicUrl;

      const ins = await sb.from("external_results").insert({
        patient_id, provider,
        taken_at: taken_at ? new Date(taken_at).toISOString().slice(0,10) : null,
        uploaded_by: "staff", note, url, content_type: contentType,
      }).select().single();
      if (ins.error) throw ins.error;
      out.push(ins.data);
    }

    return NextResponse.json({ uploaded: out.length, items: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// app/staff/other-labs/page.tsx  (SERVER COMPONENT — no "use client")
import * as React from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import UploadFormClient from "./UploadFormClient";
import BrowseOtherLabs from "./BrowseOtherLabs";

export const dynamic = "force-dynamic";

function slugSafe(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-");
}

async function uploadOne(
  sb: ReturnType<typeof supabaseAdmin>,
  file: File,
  patient_id: string,
  type: string,
  provider: string | null,
  taken_at: string | null,
  note: string | null
) {
  const bucket = process.env.NEXT_PUBLIC_EXTERNAL_RESULTS_BUCKET || "external-results";
  const dateFolder =
    taken_at && /^\d{4}-\d{2}-\d{2}$/.test(taken_at)
      ? taken_at
      : new Date().toISOString().slice(0, 10);

  const uuid = (globalThis as any).crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  const safeName = `${uuid}-${slugSafe(file.name || "file")}`;
  const path = `${patient_id}/${dateFolder}/${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const contentType =
    file.type ||
    (safeName.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream");

  const up = await sb.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    upsert: false,
  });
  if (up.error) throw up.error;

  const pub = sb.storage.from(bucket).getPublicUrl(path);
  const url = pub.data.publicUrl;

  const ins = await sb
    .from("external_results")
    .insert({
      patient_id,
      type, // ✅ NEW REQUIRED
      provider: provider || null,
      taken_at: taken_at ? new Date(taken_at).toISOString().slice(0, 10) : null,
      uploaded_by: "staff",
      note: note || null,
      url,
      content_type: contentType,
    })
    .select()
    .single();
  if (ins.error) throw ins.error;
  return ins.data;
}

export default function OtherLabsUploadPage({ searchParams }: { searchParams?: { uploaded?: string } }) {
  async function action(formData: FormData): Promise<void> {
    "use server";
    const sb = supabaseAdmin();

    const patient_id = String(formData.get("patient_id") || "").trim();
    const pid = patient_id.toUpperCase();
    const type = String(formData.get("type") || "").trim(); // ✅ required
    const provider = (formData.get("provider") as string) || null;
    const taken_at = (formData.get("taken_at") as string) || null;
    const note = (formData.get("note") as string) || null;

    if (!pid) throw new Error("patient_id is required");
    if (!type) throw new Error("type is required");
    const files = formData.getAll("files").filter(Boolean) as File[];
    if (!files.length) throw new Error("Upload at least one file");

    const { data: existsRows, error: existsErr } = await sb
      .from("patients")
      .select("patient_id")
      .ilike("patient_id", pid)
      .limit(1);
    if (existsErr) throw existsErr;
    if (!Array.isArray(existsRows) || existsRows.length === 0) {
      throw new Error(`Patient ID "${pid}" was not found. Upload cancelled.`);
    }

    for (const f of files) {
      await uploadOne(sb, f, pid, type, provider, taken_at, note);
    }

    revalidatePath("/staff/other-labs");
    redirect("/staff/other-labs");
  }

  const uploaded = Number(searchParams?.uploaded || 0);

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Upload Other Labs (JPG/PDF)</h1>
      {uploaded > 0 && (
        <div className="rounded-lg border bg-green-50 text-green-800 px-3 py-2">
          Uploaded {uploaded} file{uploaded > 1 ? "s" : ""} successfully.
        </div>
      )}

      <UploadFormClient action={action} />
      <BrowseOtherLabs />
    </div>
  );
}

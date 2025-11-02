import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

type FinalizePayload = {
  meta: {
    patient_id: string;
    encounter_id?: string | null;
    category: string;
    subtype?: string | null;
    taken_at: string; // YYYY-MM-DD
    provider: string;
    impression?: string | null;
    performer_name?: string | null;
    performer_role?: string | null;
    performer_license?: string | null;
    note?: string | null;
  };
  items: Array<{
    storagePath: string;     // from /presign
    content_type?: string;   // image/jpeg, application/pdf, etc.
  }>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FinalizePayload;

    if (!body?.meta || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supa = getSupabaseServer();

    // Insert one row per uploaded file
    const rows = body.items.map((it) => ({
      patient_id: body.meta.patient_id,
      encounter_id: body.meta.encounter_id || null,
      category: body.meta.category,
      subtype: body.meta.subtype || null,
      taken_at: body.meta.taken_at,
      provider: body.meta.provider,
      impression: body.meta.impression || null,
      performer_name: body.meta.performer_name || null,
      performer_role: body.meta.performer_role || null,
      performer_license: body.meta.performer_license || null,
      note: body.meta.note || null,
      url: it.storagePath, // store storage path only
      content_type: it.content_type || null,
      uploaded_by: "staff", // replace with session user later
      type: body.meta.subtype || body.meta.category, // keeps your legacy viewer grouping
      // uploaded_at defaults in DB
      // source default 'upload' in DB
    }));

    const { data: inserted, error } = await supa
      .from("external_results")
      .insert(rows)
      .select("id, url, category");

    if (error) throw error;

    // If this batch is ECG, create ECG cases now
    if (body.meta.category === "ecg" && inserted?.length) {
      const cases = inserted.map((r) => ({
        patient_id: body.meta.patient_id,
        encounter_id: body.meta.encounter_id || null,
        external_result_id: r.id,
        uploaded_by: "staff",
        status: "pending" as const,
        note: body.meta.note || null,
      }));

      const { error: ecgErr } = await supa.from("ecg_cases").insert(cases);
      if (ecgErr) throw ecgErr;
    }

    return NextResponse.json({ ok: true, saved: inserted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

// app/api/consultations/details/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const db = getSupabase();

    // 1) Consultation snapshot
    const c = await db
      .from("consultations")
      .select(
        `
        id,
        patient_id,
        doctor_id,
        visit_at,
        plan_shared,
        doctor_name_at_time,
        signing_doctor_name
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (c.error) return NextResponse.json({ error: c.error.message }, { status: 400 });
    if (!c.data) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });

    // 2) Doctor light profile (NOTE: your PK column is doctor_id, not id)
    let doctor: {
      display_name?: string | null;
      full_name?: string | null;
      credentials?: string | null;
    } | null = null;

    if (c.data.doctor_id) {
      const d = await db
        .from("doctors")
        .select("display_name, full_name, credentials")
        .eq("doctor_id", c.data.doctor_id) // ← key fix: match your schema
        .maybeSingle();
      doctor = d.error ? null : (d.data ?? null);
    }

    // 3) Latest doctor notes (if any)
    const dn = await db
      .from("doctor_notes")
      .select("notes_markdown, notes_soap")
      .eq("consultation_id", id)
      .order("updated_at", { ascending: false })
      .maybeSingle();

    // 4) Prescription: prefer active signed; else latest draft
    let rxId: string | null = null;
    let rxStatus: string | null = null;
    let rxNotes: string | null = null;
    let rxValidDays: number | null = null;
    let rxValidUntil: string | null = null;

    const signed = await db
      .from("prescriptions")
      .select("id, status, notes_for_patient, updated_at, valid_days, valid_until")
      .eq("consultation_id", id)
      .eq("status", "signed")
      .eq("active", true) // ← use active flag
      .order("updated_at", { ascending: false })
      .maybeSingle();

    if (signed.data?.id) {
      rxId = signed.data.id;
      rxStatus = signed.data.status;
      rxNotes = signed.data.notes_for_patient ?? null;
      rxValidDays = signed.data.valid_days ?? null;
      rxValidUntil = signed.data.valid_until ?? null;
    } else {
      const draft = await db
        .from("prescriptions")
        .select("id, status, notes_for_patient, updated_at, valid_days")
        .eq("consultation_id", id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .maybeSingle();

      if (draft.data?.id) {
        rxId = draft.data.id;
        rxStatus = draft.data.status;
        rxNotes = draft.data.notes_for_patient ?? null;
        rxValidDays = draft.data.valid_days ?? null;
        rxValidUntil = null;
      }
    }

    // 5) Rx items (if we found an Rx)
    let items: Array<{
      generic_name: string | null;
      brand_name: string | null;
      strength: string | null;
      form: string | null;
      route: string | null;
      dose_amount: number | null;
      dose_unit: string | null;
      frequency_code: string | null;
      duration_days: number | null;
      quantity: number | null;
      instructions: string | null;
      unit_price: number | null;
    }> | null = null;

    if (rxId) {
      const lines = await db
        .from("prescription_items")
        .select(
          `
          generic_name,
          brand_name,
          strength,
          form,
          route,
          dose_amount,
          dose_unit,
          frequency_code,
          duration_days,
          quantity,
          instructions,
          unit_price
        `,
        )
        .eq("prescription_id", rxId)
        .order("created_at", { ascending: true });

      items = lines.error ? null : ((lines.data ?? []) as any);
    }

    // 6) Shape response for the UI
    const details = {
      id: c.data.id,
      patient_id: c.data.patient_id,
      visit_at: c.data.visit_at,
      plan_shared: c.data.plan_shared ?? false,
      doctor, // may be null
      doctor_name_at_time: c.data.doctor_name_at_time ?? null, // reliever fallback
      signing_doctor_name: c.data.signing_doctor_name ?? null,
      notes: {
        notes_markdown: dn.data?.notes_markdown ?? null,
        notes_soap: dn.data?.notes_soap ?? null,
      },
      rx: rxId
        ? {
            id: rxId,
            status: rxStatus,
            notes_for_patient: rxNotes,
            items: items ?? [],
            valid_days: rxValidDays,
            valid_until: rxValidUntil,
          }
        : null,
    };

    return NextResponse.json({ details });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

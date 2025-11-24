// app/api/staff/med-orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireActor } from "@/lib/api-actor";
import { getSupabase } from "@/lib/supabase";

function ensureStaff(actor: Awaited<ReturnType<typeof requireActor>>) {
  return actor && actor.kind === "staff";
}

export async function GET(req: Request) {
  const actor = await requireActor();
  if (!ensureStaff(actor)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabase();

    const pendingQuery = supabase
      .from("patients")
      .select(
        "patient_id, full_name, sex, birthday, contact, delivery_address_label, delivery_address_text, delivery_lat, delivery_lng, delivery_notes, last_delivery_used_at"
      )
      .not("last_delivery_used_at", "is", null)
      .is("last_delivery_success_at", null)
      .order("last_delivery_used_at", { ascending: false });

    const deliveredQuery = supabase
      .from("patients")
      .select("patient_id, full_name, contact, last_delivery_success_at")
      .not("last_delivery_success_at", "is", null)
      .order("last_delivery_success_at", { ascending: false })
      .limit(40);

    const [pending, delivered] = await Promise.all([pendingQuery, deliveredQuery]);

    if (pending.error) {
      return NextResponse.json({ error: pending.error.message }, { status: 500 });
    }
    if (delivered.error) {
      return NextResponse.json({ error: delivered.error.message }, { status: 500 });
    }

    return NextResponse.json({
      pending: pending.data?.map((p) => ({
        patient_id: p.patient_id,
        full_name: p.full_name ?? null,
        sex: p.sex ?? null,
        birth_date: p.birthday ?? null,
        contact_no: p.contact ?? null,
        delivery_address_label: p.delivery_address_label ?? null,
        delivery_address_text: p.delivery_address_text ?? null,
        delivery_lat: p.delivery_lat ?? null,
        delivery_lng: p.delivery_lng ?? null,
        delivery_notes: p.delivery_notes ?? null,
        last_delivery_used_at: p.last_delivery_used_at ?? null,
      })) ?? [],
      delivered: delivered.data?.map((p) => ({
        patient_id: p.patient_id,
        full_name: p.full_name ?? null,
        contact_no: p.contact ?? null,
        last_delivery_success_at: p.last_delivery_success_at,
      })) ?? [],
    });
  } catch (e: any) {
    console.error("[staff/med-orders] GET unexpected", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const actor = await requireActor();
  if (!ensureStaff(actor)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { patient_id?: string };
  const patient_id = String(body.patient_id || "").trim().toUpperCase();
  if (!patient_id) {
    return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("patients")
      .update({ last_delivery_success_at: now })
      .eq("patient_id", patient_id)
      .select("patient_id, last_delivery_success_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Delivery marked as successful.",
      last_delivery_success_at: data.last_delivery_success_at,
    });
  } catch (e: any) {
    console.error("[staff/med-orders] POST unexpected", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireActor } from "@/lib/api-actor";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  patientId?: string;
  patient_id?: string;
  delivery_address_label?: string;
  delivery_address_text?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_notes?: string | null;
};

function toTrimmed(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round6(n: number) {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor().catch(() => null);
    if (!actor || actor.kind !== "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const patientId = actor.patient_id || body?.patientId || body?.patient_id;
    if (!patientId) {
      return NextResponse.json({ error: "patientId required" }, { status: 400 });
    }

    const delivery_address_label = toTrimmed(body.delivery_address_label);
    const delivery_address_text = toTrimmed(body.delivery_address_text);
    const delivery_lat_raw = toNumber(body.delivery_lat);
    const delivery_lng_raw = toNumber(body.delivery_lng);
    const delivery_notes = body.delivery_notes ?? null;

    if (!delivery_address_label || !delivery_address_text) {
      return NextResponse.json(
        { error: "delivery_address_label and delivery_address_text are required" },
        { status: 400 }
      );
    }
    if (delivery_lat_raw === null || delivery_lng_raw === null) {
      return NextResponse.json(
        { error: "delivery_lat and delivery_lng are required" },
        { status: 400 }
      );
    }

    const delivery_lat = round6(delivery_lat_raw);
    const delivery_lng = round6(delivery_lng_raw);
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("patients")
      .update({
        delivery_address_label,
        delivery_address_text,
        delivery_lat,
        delivery_lng,
        delivery_notes,
        updated_at: now,
      })
      .eq("patient_id", patientId)
      .select(
        "patient_id, full_name, delivery_address_label, delivery_address_text, delivery_lat, delivery_lng, delivery_notes, last_delivery_used_at, last_delivery_success_at"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({ patient: data }, { status: 200 });
  } catch (e: any) {
    console.error("[mobile] delivery-address error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// app/api/patient/delivery-request/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

type Body = {
  delivery_address_label?: string;
  delivery_address_text?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_notes?: string | null;
};

function toStr(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["patient"] });
    if (!auth.ok) return auth.response;
    if (auth.actor.kind !== "patient") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const delivery_address_label = toStr(body.delivery_address_label);
    const delivery_address_text = toStr(body.delivery_address_text);
    const delivery_lat = toNumber(body.delivery_lat);
    const delivery_lng = toNumber(body.delivery_lng);
    const delivery_notes = body.delivery_notes ?? null;

    if (!delivery_address_label || !delivery_address_text) {
      return NextResponse.json(
        { error: "delivery_address_label and delivery_address_text are required" },
        { status: 400 },
      );
    }
    if (delivery_lat === null || delivery_lng === null) {
      return NextResponse.json(
        { error: "delivery_lat and delivery_lng are required" },
        { status: 400 },
      );
    }

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
        last_delivery_used_at: now,
        last_delivery_success_at: null,
      })
      .eq("patient_id", auth.actor.patient_id)
      .select(
        "patient_id, full_name, delivery_address_label, delivery_address_text, delivery_lat, delivery_lng, delivery_notes, last_delivery_used_at, last_delivery_success_at",
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Delivery request saved. A representative will call to confirm your order.",
      patient: data,
    });
  } catch (e: any) {
    console.error("[patient/delivery-request] unexpected", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

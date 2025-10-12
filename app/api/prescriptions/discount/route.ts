// app/api/prescriptions/discount/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

type Payload = {
  prescriptionId: string;
  discountType?: "percent" | "amount" | "" | null;
  discountValue?: number | null;
  discountExpiresAt?: string | null;   // ISO string (local UI uses datetime-local)
  discountAppliedBy?: string | null;   // staff initials/name
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    const prescriptionId = body.prescriptionId?.trim();
    if (!prescriptionId) {
      return NextResponse.json({ error: "prescriptionId is required" }, { status: 400 });
    }

    // Normalize / validate discount inputs
    let discount_type: "percent" | "amount" | null =
      body.discountType === "percent" || body.discountType === "amount"
        ? body.discountType
        : null;

    let discount_value: number | null =
      body.discountValue == null || body.discountValue === ("" as any)
        ? null
        : Number(body.discountValue);

    if (discount_type === "percent") {
      if (discount_value == null || !isFinite(discount_value)) {
        return NextResponse.json({ error: "Percent value is required" }, { status: 400 });
      }
      if (discount_value < 0 || discount_value > 100) {
        return NextResponse.json({ error: "Percent must be 0–100" }, { status: 400 });
      }
    } else if (discount_type === "amount") {
      if (discount_value == null || !isFinite(discount_value)) {
        return NextResponse.json({ error: "Amount value is required" }, { status: 400 });
      }
      if (discount_value < 0) {
        return NextResponse.json({ error: "Amount must be ≥ 0" }, { status: 400 });
      }
    } else {
      // No discount
      discount_value = null;
    }

    // Parse expiry (optional)
    let discount_expires_at: string | null = null;
    if (body.discountExpiresAt) {
      const d = new Date(body.discountExpiresAt);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid expires_at datetime" }, { status: 400 });
      }
      discount_expires_at = d.toISOString();
    }

    const discount_applied_by =
      (body.discountAppliedBy?.trim() || null) ?? null;

    const db = getSupabase();

    // 1) Load items to compute totals
    const itemsRes = await db
      .from("prescription_items")
      .select("unit_price, quantity")
      .eq("prescription_id", prescriptionId);

    if (itemsRes.error) {
      return NextResponse.json({ error: itemsRes.error.message }, { status: 400 });
    }

    const subtotal = (itemsRes.data ?? []).reduce((sum, it) => {
      const p = Number(it.unit_price ?? 0);
      const q = Number(it.quantity ?? 0);
      return sum + (isFinite(p) && isFinite(q) ? p * q : 0);
    }, 0);

    // 2) Calculate discount (only if active at the moment we save)
    let discountAmount = 0;
    const active =
      !!discount_type &&
      discount_value != null &&
      (!discount_expires_at || new Date(discount_expires_at) > new Date());

    if (active) {
      if (discount_type === "percent") {
        discountAmount = subtotal * (Number(discount_value) / 100);
      } else if (discount_type === "amount") {
        discountAmount = Number(discount_value);
      }
      if (!isFinite(discountAmount)) discountAmount = 0;
      if (discountAmount > subtotal) discountAmount = subtotal;
    }

    const final_total = Math.max(0, subtotal - discountAmount);

    // 3) Update the prescription
    const upd = await db
      .from("prescriptions")
      .update({
        discount_type,
        discount_value,
        discount_expires_at,
        discount_applied_by,
        final_total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId)
      .select("id")
      .single();

    if (upd.error) {
      return NextResponse.json({ error: upd.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, final_total });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

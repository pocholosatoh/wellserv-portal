// app/api/prescriptions/discount/route.ts
// POST body:
// { prescriptionId, discountType: 'percent'|'amount'|null, discountValue: number|null, discountExpiresAt: string|null, discountAppliedBy: string|null }

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { prescriptionId, discountType, discountValue, discountExpiresAt, discountAppliedBy } = await req.json();

    if (!prescriptionId) {
      return NextResponse.json({ error: "prescriptionId is required" }, { status: 400 });
    }

    // Basic validation / cleanup
    let dt: string | null = null;
    if (discountExpiresAt) {
      const d = new Date(discountExpiresAt);
      if (!Number.isNaN(d.getTime())) dt = d.toISOString();
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("prescriptions")
      .update({
        discount_type: discountType ?? null,
        discount_value: discountValue ?? null,
        discount_expires_at: dt,
        discount_applied_by: discountAppliedBy ?? null,
      })
      .eq("id", prescriptionId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

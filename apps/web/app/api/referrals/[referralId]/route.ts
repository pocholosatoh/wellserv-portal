export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { buildReferralPayload } from "@/lib/referrals";

export async function GET(req: Request, context: { params: Promise<{ referralId: string }> }) {
  try {
    const auth = await guard(req, { allow: ["doctor", "staff"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const { referralId } = await context.params;
    if (!referralId) {
      return NextResponse.json({ error: "referral_id is required" }, { status: 400 });
    }

    const payload = await buildReferralPayload(referralId);
    if (!payload) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    return NextResponse.json({ referral: payload });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

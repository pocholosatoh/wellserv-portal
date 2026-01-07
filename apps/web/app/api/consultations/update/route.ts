// app/api/consultations/update/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["doctor"], requireBranch: true });
    if (!auth.ok) return auth.response;

    const supa = getSupabase();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing consultation id" }, { status: 400 });

    const { data, error } = await supa
      .from("consultations")
      .update({ branch: auth.branch })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ consultation: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

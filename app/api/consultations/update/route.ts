// app/api/consultations/update/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const supa = getSupabase();
    const { id, branch } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing consultation id" }, { status: 400 });

    const { data, error } = await supa
      .from("consultations")
      .update({ branch })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ consultation: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

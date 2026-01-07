import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { guard } from "@/lib/auth/guard";

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff", "doctor"], requirePatientId: true });
    if (!auth.ok) return auth.response;
    const { patient_id } = await req.json();
    if (!patient_id) return NextResponse.json({ error: "patient_id is required" }, { status: 400 });

    const supa = getSupabaseServer();

    // Insert minimal fields (let defaults like created_at run in DB)
    const { data, error } = await supa
      .from("encounters") // <— change if you use a different table
      .insert({ patient_id })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

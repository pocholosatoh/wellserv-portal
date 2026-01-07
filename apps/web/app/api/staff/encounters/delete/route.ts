import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

export async function POST(req: Request) {
  const auth = await guard(req, { allow: ["staff"] });
  if (!auth.ok) return auth.response;
  const db = getSupabase();
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Remove dependents first to avoid foreign key failures
    const { error: itemsErr } = await db.from("order_items").delete().eq("encounter_id", id);
    if (itemsErr) throw itemsErr;

    const { error: eventsErr } = await db.from("encounter_events").delete().eq("encounter_id", id);
    if (eventsErr) throw eventsErr;

    const { error: encErr } = await db.from("encounters").delete().eq("id", id);
    if (encErr) throw encErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to delete encounter" },
      { status: 400 },
    );
  }
}

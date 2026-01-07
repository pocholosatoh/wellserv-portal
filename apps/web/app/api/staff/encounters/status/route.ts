import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

async function handleUpdate(req: Request) {
  const auth = await guard(req, { allow: ["staff"] });
  if (!auth.ok) return auth.response;
  const db = getSupabase();
  try {
    const ct = req.headers.get("content-type") || "";
    let id = "",
      status = "",
      note = "";

    if (ct.includes("application/json")) {
      const j = await req.json().catch(() => ({}));
      id = String(j?.id || "");
      status = String(j?.status || "");
      note = String(j?.note || "");
    } else {
      const f = await req.formData();
      id = String(f.get("id") || "");
      status = String(f.get("status") || "");
      note = String(f.get("note") || "");
    }
    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    // Update encounter status
    const { error } = await db.from("encounters").update({ status }).eq("id", id);
    if (error) throw error;

    // Stamp last event with actor + optional note
    const actor_role = auth.actor.kind === "staff" ? auth.actor.role : "";
    const actor_id = auth.actor.kind === "staff" ? auth.actor.initials : "";

    const { data: ev } = await db
      .from("encounter_events")
      .select("id,actor_role,actor_id,note")
      .eq("encounter_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ev) {
      await db
        .from("encounter_events")
        .update({
          actor_role: ev.actor_role || actor_role || null,
          actor_id: ev.actor_id || actor_id || null,
          note: ev.note || (note ? String(note) : null),
        })
        .eq("id", ev.id);
    }

    const url = new URL("/staff/rmt", req.url);
    return NextResponse.redirect(url);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  return handleUpdate(req);
}

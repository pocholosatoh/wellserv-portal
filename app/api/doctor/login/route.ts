// app/api/doctor/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { setDoctorSession } from "@/lib/doctorSession";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawCode = String(body?.code ?? "").trim();
    const rawPin  = String(body?.pin  ?? "").trim();

    if (!rawCode || !rawPin) {
      return NextResponse.json({ error: "Missing code or pin" }, { status: 400 });
    }

    // Normalize
    const code = rawCode.toUpperCase();
    const pin  = rawPin.replace(/\s+/g, ""); // strip spaces just in case

    const supabase = getSupabase();

    // Case-insensitive exact match on code
    const { data: doc, error } = await supabase
      .from("doctors")
      .select("doctor_id, code, display_name, full_name, credentials, pin_hash, active")
      .ilike("code", code) // exact + case-insensitive (no %)
      .maybeSingle();

    if (error || !doc) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Active flag check (your schema uses boolean 'active')
    if (doc.active === false) {
      return NextResponse.json({ error: "Account inactive" }, { status: 403 });
    }

    // Compare with bcrypt hash
    const hash = String(doc.pin_hash || "");
    const ok = hash && (await bcrypt.compare(pin, hash));
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Build session name fields
    const baseName = doc.display_name || doc.full_name || "";
    const creds    = doc.credentials || "";
    const display  = creds ? `${baseName}, ${creds}` : baseName;

    // Set session cookie (server-only; doctorSession handles Secure flag per env)
    await setDoctorSession({
      id: doc.doctor_id,       // IMPORTANT: your PK column
      code: doc.code,
      name: baseName,          // raw name (no creds)
      role: "regular",
      credentials: creds,      // handy for UI
      display_name: display,   // "Name, MD/FPCP"
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/doctor/login] error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

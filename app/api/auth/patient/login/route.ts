// app/api/auth/patient/login/route.ts
import { NextResponse } from "next/server";
import { setSession } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // accept either env name; prefer SERVICE_ROLE if present
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { patient_id: rawPid, access_code, remember } = await req.json();

    if (!rawPid || !access_code) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const expected = process.env.PATIENT_PORTAL_ACCESS_CODE;
    if (!expected) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }
    if (access_code !== expected) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }

    // Normalize to uppercase (your DB stores uppercase pids)
    const target = String(rawPid).trim().toUpperCase();

    // Look up exact patient_id (no wildcard needed)
    const { data: row, error } = await supabase
      .from("patients")
      .select("patient_id, full_name")
      .eq("patient_id", target)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "No matching Patient ID" }, { status: 404 });
    }

    // Create response and set session cookies
    const res = NextResponse.json({ ok: true });
    setSession(res, {
      role: "patient",
      patient_id: row.patient_id,
      persist: !!remember,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login failed" }, { status: 400 });
  }
}

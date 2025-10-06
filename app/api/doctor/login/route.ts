// app/api/doctor/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// We use the service role on the server ONLY.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { code, pin } = await req.json();

    if (!code || !pin) {
      return NextResponse.json({ error: "Missing code or pin" }, { status: 400 });
    }

    // Call the DB helper we created to verify PIN
    const { data, error } = await supabase
      .rpc("doctor_login", { p_code: code, p_pin: pin });

    if (error) {
      console.error("doctor_login rpc error:", error);
      return NextResponse.json({ error: "Server error." }, { status: 500 });
    }

    // doctor_login returns an array of rows; valid login => 1 row
    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Invalid code or PIN." }, { status: 401 });
    }

    const row = data[0]; // { doctor_id, display_name, code }

    // Set a secure, httpOnly cookie so browser JS can’t read it.
    // For MVP, we’ll store doctor_id + name in a single cookie as JSON.
    // Later we can sign or encrypt if needed.
    const cookiePayload = {
      doctor_id: row.doctor_id,
      display_name: row.display_name,
      code: row.code,
      logged_in_at: Date.now(),
    };

    const cookieStore = await cookies();
    cookieStore.set("doctor_auth", JSON.stringify(cookiePayload), {
      httpOnly: true,     // JS can't read it
      secure: true,       // HTTPS only
      sameSite: "lax",
      path: "/",
      // Expires in 7 days (adjust as you like)
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

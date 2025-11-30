// app/api/auth/staff/set-pin/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { parseStaffLoginCode } from "@/lib/auth/staffCode";
import { hashPin } from "@/lib/auth/pinHash";

const LookupSchema = z.object({
  login_code: z.string().min(1),
  birthday: z.string().min(1),
});

const PinSchema = LookupSchema.extend({
  pin: z.string().min(4).max(10),
});

function normalizeBirthday(raw: string) {
  return String(raw || "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const hasPin = typeof body?.pin === "string" && body.pin.trim() !== "";
    const base = (hasPin ? PinSchema : LookupSchema).parse(body);

    const { code } = parseStaffLoginCode(base.login_code);
    const birthday = normalizeBirthday(base.birthday);

    const supa = getSupabase();
    const { data: staff, error } = await supa
      .from("staff")
      .select("id, staff_no, login_code, pin_hash, active")
      .eq("active", true)
      .eq("birthday", birthday)
      .ilike("login_code", code)
      .maybeSingle();

    if (error || !staff) {
      return NextResponse.json(
        { error: "No active staff found with these details." },
        { status: 404 }
      );
    }

    if (!hasPin) {
      if (staff.pin_hash) {
        return NextResponse.json(
          { error: "Your PIN is already set. Please use the normal login page.", alreadySet: true },
          { status: 409 }
        );
      }

      return NextResponse.json({
        ok: true,
        staff_no: staff.staff_no,
        login_code: staff.login_code || code,
      });
    }

    if (staff.pin_hash) {
      return NextResponse.json(
        { error: "Your PIN is already set. Please use the normal login page.", alreadySet: true },
        { status: 409 }
      );
    }

    const pin = String(body.pin || "").trim();
    if (!/^[0-9]{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }
    if (["0000", "1111", "1234", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999"].includes(pin)) {
      return NextResponse.json({ error: "Please choose a less obvious PIN." }, { status: 400 });
    }

    const hashed = await hashPin(pin);
    const { error: updateError } = await supa
      .from("staff")
      .update({ pin_hash: hashed, pin_set_at: new Date().toISOString() })
      .eq("id", staff.id)
      .is("pin_hash", null);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ ok: true, login_code: staff.login_code || code });
  } catch (err: any) {
    if (err?.issues?.length) {
      return NextResponse.json({ error: err.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Unable to set PIN" }, { status: 400 });
  }
}

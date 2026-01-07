// app/api/staff/register/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { guard } from "@/lib/auth/guard";
import { readSignedCookie } from "@/lib/auth/signedCookies";
import { parseStaffLoginCode } from "@/lib/auth/staffCode";

const StaffSchema = z.object({
  login_code: z.string().min(1),
  first_name: z.string().min(1),
  middle_name: z.string().min(1),
  last_name: z.string().min(1),
  birthday: z.string().min(1),
  sex: z.string().min(1),
  credentials: z.string().optional().nullable(),
  prc_number: z.string().optional().nullable(),
  position_title: z.string().optional().nullable(),
  date_started: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

async function requireAdmin() {
  const session = await getSession().catch(() => null);
  const c = await cookies();
  const prefix = (
    session?.staff_role_prefix ||
    readSignedCookie(c, "staff_role_prefix") ||
    ""
  ).toUpperCase();
  const staffRole = (
    session?.staff_role ||
    readSignedCookie(c, "staff_role") ||
    ""
  ).toLowerCase();
  const staffId = session?.staff_id || readSignedCookie(c, "staff_id") || "";
  const isAdmin = prefix === "ADM" || staffRole === "admin";
  return { isAdmin, staffId };
}

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"] });
    if (!auth.ok) return auth.response;
    const { isAdmin, staffId } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const data = StaffSchema.parse(body);
    const parsed = parseStaffLoginCode(data.login_code);

    const supa = getSupabase();
    const payload = {
      login_code: parsed.code,
      first_name: data.first_name.trim(),
      middle_name: data.middle_name.trim(),
      last_name: data.last_name.trim(),
      birthday: data.birthday,
      sex: data.sex,
      credentials: data.credentials?.trim() || null,
      prc_number: data.prc_number?.trim() || null,
      position_title: data.position_title?.trim() || null,
      date_started: data.date_started || null,
      active: data.active !== false,
      created_by_staff_id: staffId || null,
    };

    const { data: inserted, error } = await supa
      .from("staff")
      .insert(payload)
      .select("id, staff_no, login_code")
      .maybeSingle();

    if (error || !inserted) {
      throw error || new Error("Insert failed");
    }

    return NextResponse.json({
      ok: true,
      staff_no: inserted.staff_no,
      login_code: inserted.login_code,
    });
  } catch (err: any) {
    if (err?.issues?.length) {
      return NextResponse.json(
        { error: err.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err?.message || "Unable to register staff" },
      { status: 400 },
    );
  }
}

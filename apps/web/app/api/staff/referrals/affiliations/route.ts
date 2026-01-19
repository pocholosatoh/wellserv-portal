export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

function isUuid(value?: string | null) {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function normalizeOptionalText(value: any): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNumber(value: any): { ok: boolean; value: number | null } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  const num = Number(value);
  if (!Number.isFinite(num)) return { ok: false, value: null };
  return { ok: true, value: num };
}

function toBool(value: any): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return Boolean(value);
}

export async function POST(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"] });
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const doctorId = String(body?.referral_doctor_id || "").trim();
    const institutionName = String(body?.institution_name || "").trim();
    const addressLine = String(body?.address_line || "").trim();

    if (!doctorId || !isUuid(doctorId)) {
      return NextResponse.json({ error: "referral_doctor_id is invalid" }, { status: 400 });
    }
    if (!institutionName) {
      return NextResponse.json({ error: "institution_name is required" }, { status: 400 });
    }
    if (!addressLine) {
      return NextResponse.json({ error: "address_line is required" }, { status: 400 });
    }

    const sortParsed = parseOptionalNumber(body?.sort_order);
    if (!sortParsed.ok) {
      return NextResponse.json({ error: "sort_order is invalid" }, { status: 400 });
    }

    const isActive = toBool(body?.is_active);

    const db = getSupabase();
    const { data, error } = await db
      .from("referral_doctor_affiliations")
      .insert({
        referral_doctor_id: doctorId,
        institution_name: institutionName,
        address_line: addressLine,
        contact_numbers: normalizeOptionalText(body?.contact_numbers),
        schedule_text: normalizeOptionalText(body?.schedule_text),
        sort_order: sortParsed.value,
        is_active: isActive ?? true,
      })
      .select(
        "id, referral_doctor_id, institution_name, address_line, contact_numbers, schedule_text, sort_order, is_active",
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ affiliation: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await guard(req, { allow: ["staff"] });
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();

    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "id is invalid" }, { status: 400 });
    }

    const updates: Record<string, any> = {};

    if ("referral_doctor_id" in body) {
      const doctorId = String(body?.referral_doctor_id || "").trim();
      if (!doctorId || !isUuid(doctorId)) {
        return NextResponse.json({ error: "referral_doctor_id is invalid" }, { status: 400 });
      }
      updates.referral_doctor_id = doctorId;
    }

    if ("institution_name" in body) {
      const institutionName = String(body?.institution_name || "").trim();
      if (!institutionName) {
        return NextResponse.json({ error: "institution_name is required" }, { status: 400 });
      }
      updates.institution_name = institutionName;
    }

    if ("address_line" in body) {
      const addressLine = String(body?.address_line || "").trim();
      if (!addressLine) {
        return NextResponse.json({ error: "address_line is required" }, { status: 400 });
      }
      updates.address_line = addressLine;
    }

    if ("contact_numbers" in body) {
      updates.contact_numbers = normalizeOptionalText(body?.contact_numbers);
    }

    if ("schedule_text" in body) {
      updates.schedule_text = normalizeOptionalText(body?.schedule_text);
    }

    if ("sort_order" in body) {
      const sortParsed = parseOptionalNumber(body?.sort_order);
      if (!sortParsed.ok) {
        return NextResponse.json({ error: "sort_order is invalid" }, { status: 400 });
      }
      updates.sort_order = sortParsed.value;
    }

    if ("is_active" in body) {
      const isActive = toBool(body?.is_active);
      if (isActive === null) {
        return NextResponse.json({ error: "is_active is invalid" }, { status: 400 });
      }
      updates.is_active = isActive;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const db = getSupabase();
    const { data, error } = await db
      .from("referral_doctor_affiliations")
      .update(updates)
      .eq("id", id)
      .select(
        "id, referral_doctor_id, institution_name, address_line, contact_numbers, schedule_text, sort_order, is_active",
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ affiliation: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

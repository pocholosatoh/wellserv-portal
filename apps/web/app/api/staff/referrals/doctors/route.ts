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

function sanitizePrcNo(value: any): string | null {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits ? digits : null;
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
    const fullName = String(body?.full_name || "").trim();
    const specialtyId = String(body?.specialty_id || "").trim();

    if (!fullName) {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }
    if (!specialtyId || !isUuid(specialtyId)) {
      return NextResponse.json({ error: "specialty_id is invalid" }, { status: 400 });
    }

    const db = getSupabase();
    const isActive = toBool(body?.is_active);
    const { data, error } = await db
      .from("referral_doctors")
      .insert({
        full_name: fullName,
        specialty_id: specialtyId,
        credentials: normalizeOptionalText(body?.credentials),
        prc_no: sanitizePrcNo(body?.prc_no),
        is_active: isActive ?? true,
      })
      .select("id, full_name, credentials, prc_no, specialty_id, is_active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ doctor: data });
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

    if ("full_name" in body) {
      const fullName = String(body?.full_name || "").trim();
      if (!fullName) {
        return NextResponse.json({ error: "full_name is required" }, { status: 400 });
      }
      updates.full_name = fullName;
    }

    if ("specialty_id" in body) {
      const specialtyId = String(body?.specialty_id || "").trim();
      if (!specialtyId || !isUuid(specialtyId)) {
        return NextResponse.json({ error: "specialty_id is invalid" }, { status: 400 });
      }
      updates.specialty_id = specialtyId;
    }

    if ("credentials" in body) {
      updates.credentials = normalizeOptionalText(body?.credentials);
    }

    if ("prc_no" in body) {
      updates.prc_no = sanitizePrcNo(body?.prc_no);
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
      .from("referral_doctors")
      .update(updates)
      .eq("id", id)
      .select("id, full_name, credentials, prc_no, specialty_id, is_active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ doctor: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { randomUUID } from "crypto";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

const Category = z.enum(["imaging", "cytology", "microbiology", "ecg", "in_vitro", "other"]);

const PresignRequest = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1),
        contentType: z.string().min(1),
      }),
    )
    .min(1),
  patient_id: z.string().min(1),
  encounter_id: z.string().uuid().nullable().optional(),
  category: Category,
  subtype: z.string().nullable().optional(), // e.g., 'CXR_PA', 'ECG_12LEAD'; free text ok for in_vitro
  taken_at: z.string().min(1), // 'YYYY-MM-DD'
  provider: z.string().min(1),
  impression: z.string().optional(), // required except ECG (enforced in UI)
  performer_name: z.string().optional(),
  performer_role: z.string().optional(),
  performer_license: z.string().optional(),
  note: z.string().optional(),
});

function getExpectedSecret() {
  return (process.env.RMT_UPLOAD_SECRET || process.env.NEXT_PUBLIC_RMT_UPLOAD_SECRET || "").trim();
}

async function requireStaffIdentity() {
  const session = await getSession().catch(() => null);
  const c = await cookies();

  const roleCookie = c.get("role")?.value || "";
  const staffRole = session?.staff_role || c.get("staff_role")?.value || "";
  const staffInitials = session?.staff_initials || c.get("staff_initials")?.value || "";
  const staffId = session?.staff_id || c.get("staff_id")?.value || "";
  const staffCode = session?.staff_login_code || c.get("staff_login_code")?.value || "";

  const isStaff =
    (session?.role || roleCookie) === "staff" || !!staffRole || !!staffId || !!staffCode;

  if (!isStaff) return null;

  const identifier = staffId || staffCode || staffInitials || staffRole;
  if (!identifier) return null;

  return {
    id: identifier,
    role: staffRole || "staff",
    initials: staffInitials || null,
  } as const;
}

function isSecretAuthorized(req: Request) {
  const expected = getExpectedSecret();
  if (!expected) return false;
  const provided =
    req.headers.get("x-rmt-upload-secret") || req.headers.get("x-upload-secret") || "";
  return provided.trim() === expected;
}

export async function POST(req: Request) {
  try {
    const staff = await requireStaffIdentity();
    const secretOk = isSecretAuthorized(req);

    if (!staff && !secretOk) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = PresignRequest.parse(body);

    // TODO (optional): verify patient exists; verify encounter belongs to patient if provided.

    const supa = getSupabaseServer();
    const bucket = "patient-files";

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");

    // Group the batch under one folder to keep uploads tidy
    const basePrefix = `${data.patient_id}/${y}/${m}/${randomUUID()}`;
    const categorySegment =
      (data.category || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "") || "UNCATEGORIZED";
    const items: Array<{ uploadUrl: string; storagePath: string }> = [];

    for (const f of data.files) {
      const safeName = f.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const objectPath = `${basePrefix}/${categorySegment}/${safeName}`;
      const { data: signed, error } = await supa.storage
        .from(bucket)
        .createSignedUploadUrl(objectPath);

      if (error || !signed?.signedUrl) {
        throw new Error(
          `Failed to presign upload for ${f.name}: ${error?.message || "unknown error"}`,
        );
      }

      items.push({
        uploadUrl: signed.signedUrl,
        storagePath: objectPath,
      });
    }

    // Echo minimal metadata back so client can forward it to /finalize
    return NextResponse.json({
      meta: {
        patient_id: data.patient_id,
        encounter_id: data.encounter_id ?? null,
        category: data.category,
        subtype: data.subtype ?? null,
        taken_at: data.taken_at,
        provider: data.provider,
        impression: data.impression ?? null,
        performer_name: data.performer_name ?? null,
        performer_role: data.performer_role ?? null,
        performer_license: data.performer_license ?? null,
        note: data.note ?? null,
      },
      items,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

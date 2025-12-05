// app/api/staff/section-assignments/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";

type StaffContext = {
  isAdmin: boolean;
  isRmt: boolean;
  branch: string;
  staffId: string;
};

const assignSchema = z.record(z.string(), z.string().uuid().nullable());

function normalizeHub(raw?: string | null) {
  return String(raw || "").trim().toUpperCase();
}

async function getStaffContext(): Promise<StaffContext> {
  const session = await getSession().catch(() => null);
  const c = await cookies();

  const prefix = (session?.staff_role_prefix || c.get("staff_role_prefix")?.value || "").toUpperCase();
  const role = (session?.staff_role || c.get("staff_role")?.value || "").toLowerCase();
  const branch = normalizeHub(session?.staff_branch || c.get("staff_branch")?.value || "");
  const staffId = session?.staff_id || c.get("staff_id")?.value || "";

  const isAdmin = prefix === "ADM" || role === "admin";
  const isRmt = prefix === "RMT" || role === "rmt";

  return { isAdmin, isRmt, branch, staffId };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  try {
    const ctx = await getStaffContext();
    if (!ctx.isAdmin && !ctx.isRmt) {
      return jsonError("Access denied", 403);
    }

    const supa = getSupabase();
    const { data: hubs, error: hubsErr } = await supa
      .from("hubs")
      .select("code,name")
      .eq("is_active", true)
      .order("name");
    if (hubsErr) throw hubsErr;
    if (!hubs?.length) {
      return jsonError("No active hubs found", 404);
    }

    const url = new URL(req.url);
    const requestedHub = normalizeHub(url.searchParams.get("hub_code") || url.searchParams.get("hub"));
    const hubCodes = new Set((hubs || []).map((h) => normalizeHub(h.code)));

    // RMTs are pinned to their login branch; ADMs can choose.
    let hubCode = ctx.isRmt && ctx.branch && ctx.branch !== "ALL" ? ctx.branch : requestedHub;
    if (!hubCode || !hubCodes.has(hubCode)) hubCode = hubs[0].code;

    const editableHubCodes = ctx.isAdmin
      ? (hubs || []).map((h) => normalizeHub(h.code))
      : ctx.branch && ctx.branch !== "ALL" && hubCodes.has(ctx.branch)
        ? [ctx.branch]
        : [];

    const { data: sectionsRows, error: secErr } = await supa
      .from("ranges")
      .select("section")
      .not("section", "is", null)
      .order("section");
    if (secErr) throw secErr;

    const sections = Array.from(
      new Set((sectionsRows || []).map((r: any) => String(r.section || "").trim()).filter(Boolean))
    );

    const { data: rmtRows, error: staffErr } = await supa
      .from("staff")
      .select("id,first_name,last_name,login_code")
      .eq("active", true)
      .ilike("login_code", "RMT-%")
      .order("last_name")
      .order("first_name");
    if (staffErr) throw staffErr;

    const { data: assignmentRows, error: aErr } = await supa
      .from("section_assignments")
      .select("section,staff_id")
      .eq("hub_code", hubCode)
      .is("effective_to", null);
    if (aErr) throw aErr;

    const assignments: Record<string, string | null> = {};
    (assignmentRows || []).forEach((r: any) => {
      if (r.section) assignments[String(r.section)] = r.staff_id || null;
    });

    return NextResponse.json({
      ok: true,
      hub_code: hubCode,
      hubs,
      sections,
      rmts: rmtRows || [],
      assignments,
      editable_hubs: editableHubCodes,
      staff_role: ctx.isAdmin ? "admin" : ctx.isRmt ? "rmt" : "",
    });
  } catch (err: any) {
    return jsonError(err?.message || "Failed to load section assignments", 400);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getStaffContext();
    if (!ctx.isAdmin && !ctx.isRmt) {
      return jsonError("Access denied", 403);
    }

    const body = await req.json().catch(() => ({}));
    const hubCode = normalizeHub(body?.hub_code);
    const parsedAssignments = assignSchema.safeParse(body?.assignments || {});
    if (!hubCode) return jsonError("hub_code is required", 400);
    if (!parsedAssignments.success) {
      return jsonError("assignments must be a map of section → staff_id|null", 400);
    }

    // RMTs can only save for their own hub.
    if (ctx.isRmt && ctx.branch !== "ALL" && ctx.branch && hubCode !== ctx.branch) {
      return jsonError("You can only edit your current hub", 403);
    }

    const supa = getSupabase();
    const { data: hubs, error: hubsErr } = await supa
      .from("hubs")
      .select("code")
      .eq("is_active", true);
    if (hubsErr) throw hubsErr;
    const allowedHubCodes = new Set((hubs || []).map((h) => normalizeHub(h.code)));
    if (!allowedHubCodes.has(hubCode)) {
      return jsonError("Invalid or inactive hub", 400);
    }

    const desiredMap = new Map<string, string | null>();
    Object.entries(parsedAssignments.data).forEach(([section, staffId]) => {
      const sec = String(section || "").trim();
      if (!sec) return;
      desiredMap.set(sec, staffId || null);
    });

    // Validate staff IDs are active RMTs
    const targetStaffIds = Array.from(
      new Set(Array.from(desiredMap.values()).filter((v): v is string => typeof v === "string"))
    );
    if (targetStaffIds.length) {
      const { data: validRows, error: validErr } = await supa
        .from("staff")
        .select("id")
        .eq("active", true)
        .ilike("login_code", "RMT-%")
        .in("id", targetStaffIds);
      if (validErr) throw validErr;
      const valid = new Set((validRows || []).map((r: any) => r.id));
      const invalid = targetStaffIds.filter((id) => !valid.has(id));
      if (invalid.length) {
        return jsonError("One or more selected staff are invalid or inactive", 400);
      }
    }

    const { data: currentRows, error: currentErr } = await supa
      .from("section_assignments")
      .select("id,section,staff_id")
      .eq("hub_code", hubCode)
      .is("effective_to", null);
    if (currentErr) throw currentErr;

    const currentMap = new Map<string, { id: string; staff_id: string | null }>();
    (currentRows || []).forEach((r: any) => {
      if (!r.section) return;
      currentMap.set(String(r.section), { id: r.id, staff_id: r.staff_id || null });
    });

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const changes: Array<{ section: string; prev: string | null; next: string | null }> = [];

    desiredMap.forEach((next, section) => {
      const prev = currentMap.get(section)?.staff_id ?? null;
      if (prev === next) return;
      changes.push({ section, prev, next });
    });

    if (!changes.length) {
      return NextResponse.json({ ok: true, updated: 0, assignments: Object.fromEntries(desiredMap) });
    }

    for (const ch of changes) {
      const current = currentMap.get(ch.section);
      if (current) {
        const { error } = await supa
          .from("section_assignments")
          .update({ effective_to: today })
          .eq("id", current.id);
        if (error) throw error;
      }

      if (ch.next) {
        const { error } = await supa.from("section_assignments").insert({
          hub_code: hubCode,
          section: ch.section,
          staff_id: ch.next,
          effective_from: today,
          effective_to: null,
          created_by_staff_id: ctx.staffId || null,
        });
        if (error) throw error;
      }
    }

    const { data: freshRows, error: freshErr } = await supa
      .from("section_assignments")
      .select("section,staff_id")
      .eq("hub_code", hubCode)
      .is("effective_to", null);
    if (freshErr) throw freshErr;

    const assignments: Record<string, string | null> = {};
    (freshRows || []).forEach((r: any) => {
      if (r.section) assignments[String(r.section)] = r.staff_id || null;
    });

    return NextResponse.json({
      ok: true,
      updated: changes.length,
      assignments,
      hub_code: hubCode,
    });
  } catch (err: any) {
    return jsonError(err?.message || "Failed to save assignments", 400);
  }
}

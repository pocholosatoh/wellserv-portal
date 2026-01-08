// app/api/staff/audit-log/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { guard } from "@/lib/auth/guard";

const RESULT_SET = new Set(["ALLOW", "DENY", "ERROR"]);
const ACTION_SET = new Set(["READ", "WRITE", "VERIFY", "SIGN"]);
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function normalizeEnum(value: string | null, allowed: Set<string>) {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  return allowed.has(v) ? v : null;
}

function parseLimit(value: string | null) {
  const raw = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

function parseDateParam(value: string | null, endOfDay: boolean) {
  const raw = String(value || "").trim();
  if (!raw) return { value: null, error: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return {
      value: `${raw}T${endOfDay ? "23:59:59.999Z" : "00:00:00Z"}`,
      error: null,
    };
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    return { value: null, error: `Invalid ${endOfDay ? "end" : "start"} date` };
  }
  return { value: dt.toISOString(), error: null };
}

export async function GET(req: Request) {
  const auth = await guard(req, { allow: ["staff"] });
  if (!auth.ok) return auth.response;
  if (auth.actor.kind !== "staff" || !auth.actor.is_admin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const url = new URL(req.url);
  const start = parseDateParam(url.searchParams.get("start"), false);
  if (start.error) return NextResponse.json({ error: start.error }, { status: 400 });
  const end = parseDateParam(url.searchParams.get("end"), true);
  if (end.error) return NextResponse.json({ error: end.error }, { status: 400 });

  const result = normalizeEnum(url.searchParams.get("result"), RESULT_SET);
  const action = normalizeEnum(url.searchParams.get("action"), ACTION_SET);
  const limit = parseLimit(url.searchParams.get("limit"));

  try {
    const supa = getSupabase();
    let query = supa
      .from("audit_log")
      .select(
        "created_at, route, method, action, result, actor_role, actor_id, patient_id, branch_id, status_code, request_id",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (start.value) query = query.gte("created_at", start.value);
    if (end.value) query = query.lte("created_at", end.value);
    if (result) query = query.eq("result", result);
    if (action) query = query.eq("action", action);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}

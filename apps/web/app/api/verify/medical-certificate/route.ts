import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { auditActionForRequest, logAuditEvent } from "@/lib/audit/logAuditEvent";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";

function buildAuditContext(req: Request, ip: string) {
  try {
    const route = new URL(req.url).pathname;
    const method = req.method || "GET";
    const action = auditActionForRequest(route, method);
    return {
      route,
      method,
      action,
      ip: ip && ip !== "unknown" ? ip : null,
      user_agent: req.headers.get("user-agent") || null,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const auditCtx = buildAuditContext(req, ip);
  const logAudit = (
    result: "ALLOW" | "DENY" | "ERROR",
    statusCode: number,
    meta?: Record<string, string | number | boolean | null>,
  ) => {
    if (!auditCtx) return;
    void logAuditEvent({
      actor_role: "unknown",
      actor_id: null,
      actor_user_id: null,
      patient_id: null,
      branch_id: null,
      route: auditCtx.route,
      method: auditCtx.method,
      action: auditCtx.action,
      result,
      status_code: statusCode,
      ip: auditCtx.ip,
      user_agent: auditCtx.user_agent,
      meta: meta ? { ...meta, source: "public_verify" } : { source: "public_verify" },
    });
  };

  const key = `verify:medcert:${ip}`;
  const limited = await checkRateLimit({ key, limit: 30, windowMs: 60 * 1000 });
  if (!limited.ok) {
    logAudit("DENY", 429, { rate_limited: true, reason: "rate_limit" });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const code = String(searchParams.get("code") || "").trim();
  if (!code) {
    logAudit("DENY", 400, { reason: "code required" });
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("medical_certificates")
      .select(
        [
          "certificate_no",
          "patient_full_name",
          "patient_birthdate",
          "patient_age",
          "patient_sex",
          "issued_at",
          "valid_until",
          "status",
          "verification_code",
          "doctor_snapshot",
          "diagnosis_text",
          "remarks",
        ].join(", "),
      )
      .eq("verification_code", code)
      .maybeSingle();

    if (error) {
      logAudit("ERROR", 500, { reason: "supabase_error" });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logAudit("ALLOW", 200);
    return NextResponse.json({ certificate: data ?? null });
  } catch (e: any) {
    logAudit("ERROR", 500, { reason: "server_error" });
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

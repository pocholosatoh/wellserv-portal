import { NextResponse } from "next/server";
import {
  auditActionForRequest,
  isPhiRoute,
  logAuditEvent,
  type AuditActorRole,
  type AuditResult,
} from "@/lib/audit/logAuditEvent";
import { getRequestIp } from "@/lib/auth/rateLimit";
import { getSession } from "@/lib/session";
import { getDoctorSession } from "@/lib/doctorSession";
import { getMobilePatient } from "@/lib/mobileAuth";

export type BranchCode = "SI" | "SL" | "ALL";

export type Actor =
  | { kind: "patient"; patient_id: string }
  | {
      kind: "staff";
      id: string;
      role: string;
      role_prefix: string;
      branch: BranchCode | "";
      initials: string;
      is_admin: boolean;
    }
  | {
      kind: "doctor";
      id: string;
      branch: "SI" | "SL";
      name?: string;
      display_name?: string;
      philhealth_md_id?: string;
    };

export type GuardOptions = {
  allow?: Array<Actor["kind"]>;
  allowMobileToken?: boolean;
  requirePatientId?: boolean;
  requireBranch?: boolean;
  patientIdKeys?: string[];
  branchKeys?: string[];
};

export type GuardResult =
  | { ok: true; actor: Actor; patientId?: string; branch?: BranchCode }
  | { ok: false; response: NextResponse };

const DEFAULT_PATIENT_ID_KEYS = ["patient_id", "patientId", "pid"];
const DEFAULT_BRANCH_KEYS = ["branch", "branch_code", "branchCode"];

function normalizeBranch(raw?: string | null): BranchCode | "" {
  const val = String(raw || "")
    .trim()
    .toUpperCase();
  if (val === "SI" || val === "SL" || val === "ALL") return val as BranchCode;
  return "";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type AuditContext = {
  route: string;
  method: string;
  action: ReturnType<typeof auditActionForRequest>;
  ip: string | null;
  user_agent: string | null;
};

async function readJson(req: Request) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return {};
  try {
    return await req.clone().json();
  } catch {
    return {};
  }
}

function readFromKeys(
  source: Record<string, any> | URLSearchParams,
  keys: string[],
): string | null {
  for (const k of keys) {
    const raw =
      source instanceof URLSearchParams ? source.get(k) : (source as Record<string, any>)[k];
    if (raw != null) {
      const v = String(raw).trim();
      if (v) return v;
    }
  }
  return null;
}

function normalizeAuditId(value?: string | null): string | null {
  const out = String(value || "").trim();
  return out ? out : null;
}

function buildAuditContext(req: Request): AuditContext | null {
  try {
    const route = new URL(req.url).pathname;
    if (!route || !isPhiRoute(route)) return null;
    const method = req.method || "GET";
    const action = auditActionForRequest(route, method);
    const ipRaw = getRequestIp(req);
    const ip = ipRaw && ipRaw !== "unknown" ? ipRaw : null;
    const user_agent = req.headers.get("user-agent") || null;
    return { route, method, action, ip, user_agent };
  } catch {
    return null;
  }
}

function resolveAuditActor(actor: Actor | null, patientId?: string) {
  if (!actor) {
    return {
      actor_role: "unknown" as AuditActorRole,
      actor_id: null,
      patient_id: normalizeAuditId(patientId),
    };
  }

  if (actor.kind === "patient") {
    const pid = normalizeAuditId(actor.patient_id);
    return {
      actor_role: "patient" as AuditActorRole,
      actor_id: pid,
      patient_id: normalizeAuditId(patientId) || pid,
    };
  }

  if (actor.kind === "staff") {
    return {
      actor_role: "staff" as AuditActorRole,
      actor_id: normalizeAuditId(actor.id),
      patient_id: normalizeAuditId(patientId),
    };
  }

  return {
    actor_role: "doctor" as AuditActorRole,
    actor_id: normalizeAuditId(actor.id),
    patient_id: normalizeAuditId(patientId),
  };
}

function emitAuditEvent(
  ctx: AuditContext | null,
  opts: {
    actor: Actor | null;
    patientId?: string;
    result: AuditResult;
    statusCode?: number;
    reason?: string;
  },
) {
  if (!ctx) return;

  const actorInfo = resolveAuditActor(opts.actor, opts.patientId);
  const meta =
    opts.reason != null
      ? {
          reason: opts.reason,
          source: "guard",
        }
      : undefined;

  void logAuditEvent({
    actor_role: actorInfo.actor_role,
    actor_id: actorInfo.actor_id,
    actor_user_id: null,
    patient_id: actorInfo.patient_id,
    branch_id: null,
    route: ctx.route,
    method: ctx.method,
    action: ctx.action,
    result: opts.result,
    status_code: opts.statusCode ?? null,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    meta,
  });
}

async function resolveActor(req: Request, allowMobileToken: boolean) {
  if (allowMobileToken) {
    const mobile = await getMobilePatient(req).catch(() => null);
    if (mobile?.patient_id) {
      return { kind: "patient", patient_id: String(mobile.patient_id) } as Actor;
    }
  }

  const doctor = await getDoctorSession().catch(() => null);
  if (doctor?.doctorId) {
    return {
      kind: "doctor",
      id: doctor.doctorId,
      branch: doctor.branch,
      name: doctor.name,
      display_name: doctor.display_name,
      philhealth_md_id: doctor.philhealth_md_id,
    } as Actor;
  }

  const session = await getSession().catch(() => null);
  if (session?.role === "staff") {
    const role = String(session.staff_role || "").toLowerCase();
    const prefix = String(session.staff_role_prefix || "").toUpperCase();
    const isAdmin = role === "admin" || prefix === "ADM";
    return {
      kind: "staff",
      id: String(session.staff_id || session.staff_login_code || session.staff_initials || ""),
      role,
      role_prefix: prefix,
      branch: normalizeBranch(session.staff_branch),
      initials: String(session.staff_initials || ""),
      is_admin: isAdmin,
    } as Actor;
  }

  if (session?.role === "patient" && session.patient_id) {
    return { kind: "patient", patient_id: String(session.patient_id) } as Actor;
  }

  return null;
}

export async function guard(req: Request, opts: GuardOptions = {}): Promise<GuardResult> {
  const auditCtx = buildAuditContext(req);
  let actor: Actor | null = null;
  let patientId: string | undefined;
  let branch: BranchCode | undefined;

  try {
    actor = await resolveActor(req, !!opts.allowMobileToken);
    if (!actor) {
      emitAuditEvent(auditCtx, { actor, patientId, result: "DENY", statusCode: 401 });
      return { ok: false, response: jsonError("Unauthorized", 401) };
    }

    if (opts.allow && !opts.allow.includes(actor.kind)) {
      emitAuditEvent(auditCtx, {
        actor,
        patientId,
        result: "DENY",
        statusCode: 403,
        reason: "Forbidden",
      });
      return { ok: false, response: jsonError("Forbidden", 403) };
    }

    if (opts.requirePatientId) {
      if (actor.kind === "patient") {
        patientId = actor.patient_id;

        const url = new URL(req.url);
        const body = await readJson(req);
        const requested =
          readFromKeys(url.searchParams, opts.patientIdKeys || DEFAULT_PATIENT_ID_KEYS) ||
          readFromKeys(body, opts.patientIdKeys || DEFAULT_PATIENT_ID_KEYS);
        if (requested && requested !== actor.patient_id) {
          emitAuditEvent(auditCtx, {
            actor,
            patientId,
            result: "DENY",
            statusCode: 403,
            reason: "Forbidden",
          });
          return { ok: false, response: jsonError("Forbidden", 403) };
        }
      } else {
        const url = new URL(req.url);
        const body = await readJson(req);
        const requested =
          readFromKeys(url.searchParams, opts.patientIdKeys || DEFAULT_PATIENT_ID_KEYS) ||
          readFromKeys(body, opts.patientIdKeys || DEFAULT_PATIENT_ID_KEYS);
        if (!requested) {
          emitAuditEvent(auditCtx, {
            actor,
            patientId,
            result: "DENY",
            statusCode: 400,
            reason: "patient_id required",
          });
          return { ok: false, response: jsonError("patient_id required", 400) };
        }
        patientId = requested;
      }
    }

    if (opts.requireBranch) {
      if (actor.kind === "patient") {
        emitAuditEvent(auditCtx, {
          actor,
          patientId,
          result: "DENY",
          statusCode: 403,
          reason: "Forbidden",
        });
        return { ok: false, response: jsonError("Forbidden", 403) };
      }
      if (actor.kind === "doctor") {
        branch = actor.branch;
      } else if (actor.kind === "staff") {
        if (!actor.branch) {
          emitAuditEvent(auditCtx, {
            actor,
            patientId,
            result: "DENY",
            statusCode: 400,
            reason: "Branch not set",
          });
          return { ok: false, response: jsonError("Branch not set", 400) };
        }
        branch = actor.branch;
      }

      const url = new URL(req.url);
      const body = await readJson(req);
      const requested =
        readFromKeys(url.searchParams, opts.branchKeys || DEFAULT_BRANCH_KEYS) ||
        readFromKeys(body, opts.branchKeys || DEFAULT_BRANCH_KEYS);
      const requestedBranch = normalizeBranch(requested || "");
      if (requestedBranch && branch && branch !== "ALL" && requestedBranch !== branch) {
        emitAuditEvent(auditCtx, {
          actor,
          patientId,
          result: "DENY",
          statusCode: 403,
          reason: "Forbidden",
        });
        return { ok: false, response: jsonError("Forbidden", 403) };
      }
    }

    emitAuditEvent(auditCtx, { actor, patientId, result: "ALLOW" });
    return { ok: true, actor, patientId, branch };
  } catch (error) {
    emitAuditEvent(auditCtx, {
      actor,
      patientId,
      result: "ERROR",
      reason: "guard_exception",
    });
    throw error;
  }
}

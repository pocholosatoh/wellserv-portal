import type { Actor, BranchCode } from "./guard";

export type GuardPolicyDecision = {
  ok: boolean;
  status?: number;
  message?: string;
  reason?: string;
  patientId?: string;
  branch?: BranchCode;
};

export const DEFAULT_PATIENT_ID_KEYS = ["patient_id", "patientId", "pid"];
export const DEFAULT_BRANCH_KEYS = ["branch", "branch_code", "branchCode"];

export function normalizeBranch(raw?: string | null): BranchCode | "" {
  const val = String(raw || "")
    .trim()
    .toUpperCase();
  if (val === "SI" || val === "SL" || val === "ALL") return val as BranchCode;
  return "";
}

export function requireActor(actor: Actor | null): GuardPolicyDecision {
  if (!actor) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  return { ok: true };
}

export function checkActorAllowed(
  actor: Actor,
  allow?: Array<Actor["kind"]>,
): GuardPolicyDecision {
  if (allow && !allow.includes(actor.kind)) {
    return { ok: false, status: 403, message: "Forbidden", reason: "Forbidden" };
  }
  return { ok: true };
}

export function checkPatientScope(
  actor: Actor,
  requestedPatientId: string | null,
): GuardPolicyDecision {
  if (actor.kind === "patient") {
    const patientId = actor.patient_id;
    if (requestedPatientId && requestedPatientId !== actor.patient_id) {
      return {
        ok: false,
        status: 403,
        message: "Forbidden",
        reason: "Forbidden",
        patientId,
      };
    }
    return { ok: true, patientId };
  }

  if (!requestedPatientId) {
    return {
      ok: false,
      status: 400,
      message: "patient_id required",
      reason: "patient_id required",
    };
  }

  return { ok: true, patientId: requestedPatientId };
}

export function checkBranchRequirement(actor: Actor): GuardPolicyDecision {
  if (actor.kind === "patient") {
    return { ok: false, status: 403, message: "Forbidden", reason: "Forbidden" };
  }

  let branch: BranchCode | undefined;
  if (actor.kind === "doctor") {
    branch = actor.branch;
  } else if (actor.kind === "staff") {
    if (!actor.branch) {
      return { ok: false, status: 400, message: "Branch not set", reason: "Branch not set" };
    }
    branch = actor.branch;
  }

  return { ok: true, branch };
}

export function checkBranchMatch(
  branch: BranchCode | undefined,
  requestedBranch: string | null,
): GuardPolicyDecision {
  const normalizedRequested = normalizeBranch(requestedBranch || "");
  if (normalizedRequested && branch && branch !== "ALL" && normalizedRequested !== branch) {
    return {
      ok: false,
      status: 403,
      message: "Forbidden",
      reason: "Forbidden",
      branch,
    };
  }
  return { ok: true, branch };
}

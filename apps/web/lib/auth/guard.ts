import { NextResponse } from "next/server";
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
  const actor = await resolveActor(req, !!opts.allowMobileToken);
  if (!actor) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  if (opts.allow && !opts.allow.includes(actor.kind)) {
    return { ok: false, response: jsonError("Forbidden", 403) };
  }

  let patientId: string | undefined;
  if (opts.requirePatientId) {
    if (actor.kind === "patient") {
      patientId = actor.patient_id;

      const url = new URL(req.url);
      const body = await readJson(req);
      const requested =
        readFromKeys(url.searchParams, opts.patientIdKeys || DEFAULT_PATIENT_ID_KEYS) ||
        readFromKeys(body, opts.patientIdKeys || DEFAULT_PATIENT_ID_KEYS);
      if (requested && requested !== actor.patient_id) {
        return { ok: false, response: jsonError("Forbidden", 403) };
      }
    } else {
      const url = new URL(req.url);
      const body = await readJson(req);
      const requested =
        readFromKeys(url.searchParams, opts.patientIdKeys || DEFAULT_PATIENT_ID_KEYS) ||
        readFromKeys(body, opts.patientIdKeys || DEFAULT_PATIENT_ID_KEYS);
      if (!requested) {
        return { ok: false, response: jsonError("patient_id required", 400) };
      }
      patientId = requested;
    }
  }

  let branch: BranchCode | undefined;
  if (opts.requireBranch) {
    if (actor.kind === "patient") {
      return { ok: false, response: jsonError("Forbidden", 403) };
    }
    if (actor.kind === "doctor") {
      branch = actor.branch;
    } else if (actor.kind === "staff") {
      if (!actor.branch) {
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
      return { ok: false, response: jsonError("Forbidden", 403) };
    }
  }

  return { ok: true, actor, patientId, branch };
}

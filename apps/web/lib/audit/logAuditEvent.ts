import "server-only";

import { getSupabaseServer } from "@/lib/supabaseServer";

export type AuditAction = "READ" | "WRITE" | "VERIFY" | "SIGN";
export type AuditResult = "ALLOW" | "DENY" | "ERROR";
export type AuditActorRole = "staff" | "doctor" | "patient" | "system" | "unknown";
export type AuditMetaValue = string | number | boolean | null;

export type AuditEventInput = {
  actor_user_id?: string | null;
  actor_id?: string | null;
  actor_role: AuditActorRole;
  branch_id?: string | null;
  patient_id?: string | null;
  route: string;
  method: string;
  action: AuditAction;
  result: AuditResult;
  status_code?: number | null;
  request_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  meta?: Record<string, AuditMetaValue>;
};

const ALLOWED_META_KEYS = new Set(["reason", "source", "rate_limited", "event", "referral_id"]);
const MAX_ROUTE_LEN = 512;
const MAX_METHOD_LEN = 16;
const MAX_REQUEST_ID_LEN = 128;
const MAX_IP_LEN = 64;
const MAX_UA_LEN = 256;

const PHI_ROUTE_PREFIXES = [
  "/api/claims",
  "/api/consents",
  "/api/consultations",
  "/api/doctor/consultations",
  "/api/doctor/ecg",
  "/api/doctor/medical-certificates",
  "/api/doctor/patient-self-monitoring",
  "/api/doctor-note-templates",
  "/api/doctor-notes",
  "/api/ecg",
  "/api/encounters",
  "/api/followups",
  "/api/mobile/other-labs",
  "/api/mobile/patient-results",
  "/api/mobile/patient/delivery-address",
  "/api/mobile/patient/delivery-request",
  "/api/mobile/patient/followups",
  "/api/mobile/patient/latest-encounter",
  "/api/mobile/patient/monitoring",
  "/api/mobile/patient/prescriptions",
  "/api/mobile/patient/vitals",
  "/api/patient-results",
  "/api/patient/delivery-request",
  "/api/patient/other-labs",
  "/api/patient/other-labs-v2",
  "/api/patient/prescriptions",
  "/api/prescriptions",
  "/api/referrals",
  "/api/staff/encounters",
  "/api/staff/intake",
  "/api/staff/med-orders",
  "/api/staff/other-labs",
  "/api/staff/patient-results",
  "/api/staff/patient-self-monitoring",
  "/api/staff/patients",
  "/api/staff/prescriptions",
  "/api/staff/self-monitoring",
  "/api/staff/uploads",
  "/api/staff/vitals",
];

function clampText(value: string | null | undefined, maxLen: number) {
  if (!value) return null;
  const text = String(value);
  if (!text) return null;
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

export function sanitizeAuditMeta(
  meta?: Record<string, AuditMetaValue> | null,
): Record<string, AuditMetaValue> | null {
  if (!meta) return null;
  const out: Record<string, AuditMetaValue> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!ALLOWED_META_KEYS.has(key)) continue;
    if (
      value === null ||
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      if (value !== undefined) out[key] = value ?? null;
    }
  }
  return Object.keys(out).length ? out : null;
}

export function auditActionForRequest(pathname: string, method: string): AuditAction {
  const segments = pathname.toLowerCase().split("/").filter(Boolean);
  if (segments.includes("verify")) return "VERIFY";
  if (segments.includes("sign")) return "SIGN";

  const verb = method.toUpperCase();
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return "READ";
  return "WRITE";
}

export function isPhiRoute(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return PHI_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const supabase = getSupabaseServer();
    const payload = {
      actor_user_id: input.actor_user_id ?? null,
      actor_id: input.actor_id ?? null,
      actor_role: input.actor_role,
      branch_id: input.branch_id ?? null,
      patient_id: input.patient_id ?? null,
      route: clampText(input.route, MAX_ROUTE_LEN) ?? "unknown",
      method: clampText(input.method, MAX_METHOD_LEN) ?? "UNKNOWN",
      action: input.action,
      result: input.result,
      status_code: input.status_code ?? null,
      request_id: clampText(input.request_id ?? null, MAX_REQUEST_ID_LEN),
      ip: clampText(input.ip ?? null, MAX_IP_LEN),
      user_agent: clampText(input.user_agent ?? null, MAX_UA_LEN),
      meta: sanitizeAuditMeta(input.meta),
    };

    const { error } = await supabase.from("audit_log").insert(payload);
    if (error) {
      console.warn("[audit] insert failed");
    }
  } catch (error) {
    console.warn("[audit] insert failed");
  }
}

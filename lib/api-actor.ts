// lib/api-actor.ts
import { cookies as getCookies } from "next/headers";
import { getSession } from "@/lib/session";
import { getDoctorSession } from "@/lib/doctorSession";

type Branch = "SI" | "SL";

export type Actor =
  | { kind: "patient"; patient_id: string }
  | { kind: "staff"; id: string }
  | {
      kind: "doctor";
      id: string;                   // doctor UUID or "relief_xxx"
      branch: Branch;               // normalized branch
      philhealth_md_id?: string;    // for PHIC claim eligibility
      name?: string;                // optional convenience
      display_name?: string;        // optional convenience
    };

export async function requireActor(): Promise<Actor | null> {
  let session: Awaited<ReturnType<typeof getSession>> | null = null;

  // 1) Patient (self-view via httpOnly session)
  try {
    session = await getSession();
    if (session && session.role === "patient" && session.patient_id) {
      return { kind: "patient", patient_id: String(session.patient_id) };
    }
  } catch {
    session = null; // ignore and fall through
  }

  // 2) Staff (either legacy staff_id cookie or new staff_* cookies)
  const c = await getCookies();
  const roleCookie = c.get("role")?.value || "";
  const staffRole = session?.staff_role || c.get("staff_role")?.value || "";
  const staffInitials = session?.staff_initials || c.get("staff_initials")?.value || "";
  const staffId = c.get("staff_id")?.value || "";

  const isStaff =
    session?.role === "staff" ||
    roleCookie === "staff" ||
    !!staffRole ||
    !!staffId;

  if (isStaff) {
    const identifier = staffId || staffInitials || staffRole || roleCookie;
    if (identifier) {
      return { kind: "staff", id: identifier };
    }
  }

  // 3) Doctor session (regular or reliever)
  const doc = await getDoctorSession().catch(() => null);
  if (doc?.doctorId) {
    return {
      kind: "doctor",
      id: doc.doctorId,
      branch: doc.branch,
      philhealth_md_id: doc.philhealth_md_id, // may be undefined for reliever/no-PHIC
      name: doc.name,
      display_name: doc.display_name,
    };
  }

  return null;
}

/** Reads the target patient_id in a TS-safe way for GET/POST routes. */
export function getTargetPatientId(
  actor: Actor,
  opts: { searchParams?: URLSearchParams; body?: any }
): string | null {
  if (actor.kind === "patient") return actor.patient_id;

  // doctor or staff must supply a patient id
  const p =
    opts.body?.patientId ??
    opts.body?.patient_id ??
    opts.searchParams?.get("patient_id") ??
    opts.searchParams?.get("pid") ??
    null;

  return p ? String(p) : null;
}

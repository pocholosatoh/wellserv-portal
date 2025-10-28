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
  // 1) Patient (self-view via httpOnly session)
  try {
    const s = await getSession();
    if (s && s.role === "patient" && s.patient_id) {
      return { kind: "patient", patient_id: String(s.patient_id) };
    }
  } catch {
    // not a patient portal call – ignore
  }

  // 2) Staff cookie (works with your existing staff flows)
  const c = await getCookies();
  const staffId = c.get("staff_id")?.value;
  if (staffId) return { kind: "staff", id: staffId };

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

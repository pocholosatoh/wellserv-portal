// lib/doctorSession.ts
import { cookies as getCookies } from "next/headers";

export type DoctorSession = {
  id: string;                           // cookie doctor_id (UUID or "relief_xxx")
  code: string;
  name: string;
  role: "regular" | "relief";
  credentials?: string;
  display_name?: string;
  doctorId: string;                     // alias of id
  branch: "SI" | "SL";                  // normalized branch
  philhealth_md_id?: string;            // for claims when reliever logs in with PHIC
};

/**
 * Reads doctor session cookies written by your doctor/reliever login APIs.
 * If no explicit branch, falls back to staff_branch; default "SI".
 * Normalizes branch: any non-"SL" becomes "SI" to keep a single-branch queue.
 */
export async function getDoctorSession(): Promise<DoctorSession | null> {
  // Next 15: in your env this returns a Promise, so await it
  const c = await getCookies();

  const id = c.get("doctor_id")?.value || null;
  if (!id) return null;

  const code = c.get("doctor_code")?.value || "";
  const name = c.get("doctor_name")?.value || "";
  const role = (c.get("doctor_role")?.value || "regular") as "regular" | "relief";
  const credentials = c.get("doctor_credentials")?.value || undefined;
  const display_name = c.get("doctor_display_name")?.value || undefined;
  const philhealth_md_id = c.get("doctor_philhealth_md_id")?.value || undefined;

  const rawBranch =
    (c.get("doctor_branch")?.value ||
      c.get("staff_branch")?.value ||
      "SI")
      .toUpperCase();

  const branch: "SI" | "SL" = rawBranch === "SL" ? "SL" : "SI";

  return {
    id,
    code,
    name,
    role,
    credentials,
    display_name,
    philhealth_md_id,
    doctorId: id,
    branch,
  };
}

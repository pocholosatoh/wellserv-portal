// lib/doctorSession.ts
import { cookies as getCookies } from "next/headers";
import { readSignedCookie } from "@/lib/auth/signedCookies";

export type DoctorSession = {
  id: string; // cookie doctor_id (UUID or "relief_xxx")
  code: string;
  name: string;
  role: "regular" | "relief";
  credentials?: string;
  display_name?: string;
  prc_no?: string;
  doctorId: string; // alias of id
  branch: "SI" | "SL"; // normalized branch
  philhealth_md_id?: string; // for claims when reliever logs in with PHIC
};

/**
 * Reads doctor session cookies written by your doctor/reliever login APIs.
 * If no explicit branch, falls back to staff_branch; default "SI".
 * Normalizes branch: any non-"SL" becomes "SI" to keep a single-branch queue.
 */
export async function getDoctorSession(): Promise<DoctorSession | null> {
  // Next 15: in your env this returns a Promise, so await it
  const c = await getCookies();

  const id = readSignedCookie(c, "doctor_id");
  if (!id) return null;

  const code = readSignedCookie(c, "doctor_code") || "";
  const name = readSignedCookie(c, "doctor_name") || "";
  const role = (readSignedCookie(c, "doctor_role") || "regular") as "regular" | "relief";
  const credentials = readSignedCookie(c, "doctor_credentials") || undefined;
  const display_name = readSignedCookie(c, "doctor_display_name") || undefined;
  const prc_no = readSignedCookie(c, "doctor_prc_no") || undefined;
  const philhealth_md_id = readSignedCookie(c, "doctor_philhealth_md_id") || undefined;

  const rawBranch = (
    readSignedCookie(c, "doctor_branch") ||
    readSignedCookie(c, "staff_branch") ||
    "SI"
  ).toUpperCase();

  const branch: "SI" | "SL" = rawBranch === "SL" ? "SL" : "SI";

  return {
    id,
    code,
    name,
    role,
    credentials,
    display_name,
    prc_no,
    philhealth_md_id,
    doctorId: id,
    branch,
  };
}

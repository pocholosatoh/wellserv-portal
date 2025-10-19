import { cookies } from "next/headers";

/**
 * Returns your existing session (if any).
 * If not present, but our new staff cookies exist,
 * synthesize a lightweight "staff" session so the protected
 * layout and middleware let the user in.
 */
export async function getSession(): Promise<
  | { role: string; name?: string | null; sub?: string | null }
  | null
> {
  // If you have any legacy session logic, keep it above this line
  // and return it when present. Otherwise fall through to cookies.

  const c = await cookies();

  // Require at least role + initials cookie.
  const staffRole = c.get("staff_role")?.value;          // "reception" | "rmt" | "admin"
  const staffInitials = c.get("staff_initials")?.value;  // "CHL"

  if (staffRole && staffInitials) {
    return {
      role: "staff",                 // ✅ your protected layout checks for this
      name: staffInitials,           // shown by StaffNavi
      sub: `staff:${staffInitials}`, // optional identifier
    };
  }

  // No session found
  return null;
}

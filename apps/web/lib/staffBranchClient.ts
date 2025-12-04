// lib/staffBranchClient.ts
export type StaffBranch = "SI" | "SL" | "ALL";

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

/**
 * Read the staff_branch cookie set during login.
 * Defaults to the provided branch when missing/invalid.
 */
export function getLoginBranch(defaultBranch: StaffBranch = "SI"): StaffBranch {
  const raw = readCookie("staff_branch");
  const upper = (raw || "").toUpperCase();
  if (upper === "SI" || upper === "SL" || upper === "ALL") return upper as StaffBranch;
  return defaultBranch;
}

/**
 * For branch-scoped UIs that need a concrete branch code.
 * Falls back to `fallback` if cookie is missing or set to ALL.
 */
export function resolveScopedBranch(fallback: "SI" | "SL" = "SI"): "SI" | "SL" {
  const branch = getLoginBranch(fallback);
  if (branch === "SI" || branch === "SL") return branch;
  return fallback;
}

// lib/staffBranchClient.ts
export type StaffBranch = "SI" | "SL" | "ALL";

const STORAGE_KEY = "staff_branch_local";

function readLocalBranch() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Read the staff_branch cookie set during login.
 * Defaults to the provided branch when missing/invalid.
 */
export function getLoginBranch(defaultBranch: StaffBranch = "SI"): StaffBranch {
  const raw = readLocalBranch();
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

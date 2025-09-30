// lib/branches.ts

/**
 * Resolves spreadsheet IDs from:
 * - Branch code: "SI" | "SL" | "GC"
 * - ENV var name: "SI_RUNNING_SHEET_ID" | "SL_RUNNING_SHEET_ID" | "GC_RUNNING_SHEET_ID"
 * - Full Google Sheets URL
 * - Raw spreadsheet ID
 *
 * Also provides a sheet/tab name (default "Results").
 */

export type BranchCode = "SI" | "SL" | "GC";

const BRANCH_TO_ENV: Record<BranchCode, string> = {
  SI: "SI_RUNNING_SHEET_ID",
  SL: "SL_RUNNING_SHEET_ID",
  GC: "GC_RUNNING_SHEET_ID",
};

export function extractIdFromUrl(maybeUrlOrId: string): string {
  const m = String(maybeUrlOrId).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : String(maybeUrlOrId).trim();
}

/**
 * Accepts:
 * - branch code ("SI" | "SL" | "GC")
 * - env name (e.g., "SI_RUNNING_SHEET_ID")
 * - raw id or full URL
 */
export function resolveSpreadsheetId(key: string): string {
  if (!key) return "";
  const trimmed = String(key).trim();

  // 1) Branch code
  const upper = trimmed.toUpperCase();
  if ((["SI", "SL", "GC"] as const).includes(upper as BranchCode)) {
    const envName = BRANCH_TO_ENV[upper as BranchCode];
    const envVal = process.env[envName] || "";
    return extractIdFromUrl(envVal || trimmed);
  }

  // 2) ENV var name
  const envVal = process.env[trimmed];
  if (envVal && envVal.trim() !== "") {
    return extractIdFromUrl(envVal.trim());
  }

  // 3) Raw ID or URL
  return extractIdFromUrl(trimmed);
}

/** Default tab name for all branches, override if you really need per-branch. */
export function getTabNameForBranch(_key?: string): string {
  return "Results";
}

// ---- add at bottom of lib/branches.ts ----
export type BranchOption = { key: "SI" | "SL" | "GC"; label: string };

export const BRANCHES: BranchOption[] = [
  { key: "SI", label: "San Isidro" },
  { key: "SL", label: "San Leonardo" },
  { key: "GC", label: "Glochem" },
];

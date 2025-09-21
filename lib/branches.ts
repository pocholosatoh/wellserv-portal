// lib/branches.ts
export type BranchDef = {
  key: string;                // short slug used in requests, e.g. "si", "sl"
  label: string;              // shown in the UI
  env: string;                // env var name that stores the Google Sheet ID
  tabEnv?: string;            // optional: env var name for tab name (defaults to HEMA_TAB or "Database")
};

// Single source of truth for branches
export const BRANCHES: BranchDef[] = [
  { key: "si", label: "San Isidro (SI)",   env: "SI_RUNNING_SHEET_ID" },
  { key: "sl", label: "San Leonardo (SL)", env: "SL_RUNNING_SHEET_ID" },
  { key: "gc", label: "Glochem (GC)", env: "GC_RUNNING_SHEET_ID" },
  // add new branches below (example):
  // { key: "ga", label: "Gapan (GA)", env: "GA_RUNNING_SHEET_ID" },
];

// Used by API only (reads server envs; do not expose to client)
export function sheetIdFor(key: string): string {
  const def = BRANCHES.find(b => b.key === key);
  return def ? (process.env[def.env] || "") : "";
}

export function tabNameFor(key: string): string {
  const def = BRANCHES.find(b => b.key === key);
  const fromDef = def?.tabEnv ? (process.env[def.tabEnv] || "") : "";
  return fromDef || process.env.HEMA_TAB || "Database";
}
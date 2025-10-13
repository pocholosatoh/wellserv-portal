// lib/hubs.ts
export const BRANCHES = [
  "San Isidro",
  "San Leonardo",
  // add more when needed
] as const;

export type Branch = typeof BRANCHES[number];

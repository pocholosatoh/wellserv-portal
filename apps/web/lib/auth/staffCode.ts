// lib/auth/staffCode.ts
export type StaffRolePrefix = "ADM" | "REC" | "RMT";

export type ParsedStaffLoginCode = {
  code: string;          // normalized uppercase code, e.g. "ADM-CHL"
  prefix: StaffRolePrefix;
  initials: string;      // "CHL"
};

export function staffRoleFromPrefix(prefix?: string): "admin" | "reception" | "rmt" | "" {
  const p = String(prefix || "").toUpperCase();
  if (p === "ADM") return "admin";
  if (p === "REC") return "reception";
  if (p === "RMT") return "rmt";
  return "";
}

export function parseStaffLoginCode(raw: string): ParsedStaffLoginCode {
  const code = String(raw || "").trim().toUpperCase();
  const m = code.match(/^(ADM|REC|RMT)-([A-Z]{2,5})$/);
  if (!m) {
    throw new Error("Login code must look like ADM-CHL, REC-ANN, or RMT-JDS.");
  }
  const [, prefix, initials] = m;
  return { code, prefix: prefix as StaffRolePrefix, initials };
}

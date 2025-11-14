// lib/auth/parseStaffCode.ts
export type ParsedStaff = {
  role: "reception" | "rmt" | "admin";
  branch_code: "SI" | "SL" | "ALL";
  staff_initials: string;
};

export function parseStaffCode(codeInput: string, typedInitialsInput: string): ParsedStaff {
  const code = (codeInput || "").trim().toUpperCase();
  const typed = (typedInitialsInput || "").trim().toUpperCase();
  const m = code.match(/^(RMT|REC|ADM)-(SI|SL|ALL)-([A-Z]{2,5})$/);
  if (!m) throw new Error("Invalid access code format.");
  const [, roleRaw, branch, initials] = m;
  if (typed !== initials) throw new Error("Initials don't match the code.");

  const role = roleRaw === "REC" ? "reception" : roleRaw === "RMT" ? "rmt" : "admin";
  return { role, branch_code: branch as ParsedStaff["branch_code"], staff_initials: initials };
}

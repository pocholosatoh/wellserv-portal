// lib/env.ts
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing required env: ${name}`);
  return v;
}
function pick(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim() !== "") return v;
  }
  throw new Error(`Missing required env (tried): ${names.join(", ")}`);
}

function getGooglePrivateKey(): string {
  const b64 = process.env.GOOGLE_PRIVATE_KEY_B64 || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64;
  if (b64 && b64.trim() !== "") return Buffer.from(b64, "base64").toString("utf8");
  const raw = pick("GOOGLE_PRIVATE_KEY", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  return raw.replace(/\\n/g, "\n");
}

// Remove surrounding quotes & trim
function clean(str: string): string {
  const s = (str || "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

export const ENV = {
  GOOGLE_CLIENT_EMAIL: pick("GOOGLE_CLIENT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  GOOGLE_PRIVATE_KEY: getGooglePrivateKey(),

  SHEET_ID: required("SHEET_ID"),
  SHEET_RANGE: clean(process.env.SHEET_RANGE || "Results!A:ZZ"),
  SHEET_RANGES: clean(process.env.SHEET_RANGES || "Ranges!A:K"),
  SHEET_CONFIG: clean(process.env.SHEET_CONFIG || "Config!A:B"),
  SHEET_PATIENTS: clean(process.env.SHEET_PATIENTS || "Patients!A:ZZ"),

  SI_RUNNING_SHEET_ID: clean(process.env.SI_RUNNING_SHEET_ID || ""),
  SL_RUNNING_SHEET_ID: clean(process.env.SL_RUNNING_SHEET_ID || ""),
  GC_RUNNING_SHEET_ID: clean(process.env.GC_RUNNING_SHEET_ID || ""),

  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

export function envDiagnostics() {
  return {
    SHEET_ID: !!ENV.SHEET_ID,
    SHEET_RANGE: ENV.SHEET_RANGE,
  };
}

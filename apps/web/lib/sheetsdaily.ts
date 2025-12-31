// lib/sheetsdaily.ts
export type RunningRow = {
  encounter_id: string; // ✅ NEW: required UUID (string)
  patient_id: string;
  full_name: string; // "SURNAME, FIRSTNAME" (ALL CAPS)
  age?: string; // leave "" so the sheet computes
  sex: "M" | "F";
  birthday: string; // MM/DD/YYYY
  contact?: string;
  address?: string;
  date_of_test?: string; // MM/DD/YYYY (defaults to Manila today)
  notes?: string; // comma-separated tests
};

function manilaTodayMMDDYYYY(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.APP_TZ || "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  const yy = parts.find((p) => p.type === "year")?.value ?? "1970";
  return `${mm}/${dd}/${yy}`;
}

function isMMDDYYYY(s: string | undefined | null) {
  return !!s && /^\d{2}\/\d{2}\/\d{4}$/.test(s);
}

// ✅ NEW: simple UUID v4-ish check
function isUuidLike(s: string | undefined | null) {
  return (
    !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  );
}

async function postJSON(url: string, body: unknown, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000); // 12s hard timeout
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      ...init,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    return { res, text, json: parsed };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calls your Apps Script Web App endpoint to append a row.
 * Throws with a detailed error if anything goes wrong.
 */
export async function appendRunningRow(branchCode: "SI" | "SL", row: RunningRow) {
  const endpoint = process.env.APPS_SCRIPT_ENDPOINT!;
  const token = process.env.APPS_SCRIPT_TOKEN!;
  const tab = process.env.RUNNING_SHEET_TAB || "Results";
  const sheetId =
    branchCode === "SI" ? process.env.SI_RUNNING_SHEET_ID : process.env.SL_RUNNING_SHEET_ID;

  if (!endpoint || !token || !sheetId) {
    throw new Error(
      "Sheets env missing: APPS_SCRIPT_ENDPOINT/APPS_SCRIPT_TOKEN/(SI|SL)_RUNNING_SHEET_ID",
    );
  }

  // ✅ Validate encounter_id (required)
  if (!isUuidLike(row.encounter_id)) {
    throw new Error(`Invalid or missing encounter_id (must be UUID): "${row.encounter_id}"`);
  }

  // Validate date fields early so we don’t send garbage to the Script
  const birthday = row.birthday;
  const date_of_test = row.date_of_test || manilaTodayMMDDYYYY();
  if (!isMMDDYYYY(birthday)) {
    throw new Error(`Invalid birthday format (expected MM/DD/YYYY): "${birthday}"`);
  }
  if (!isMMDDYYYY(date_of_test)) {
    throw new Error(`Invalid date_of_test format (expected MM/DD/YYYY): "${date_of_test}"`);
  }

  const payload = {
    token,
    sheetId,
    tab,
    row: {
      ...row,
      birthday,
      date_of_test,
      age: row.age ?? "", // let the sheet compute
      // encounter_id is included via spread ✅
    },
  };

  // Small retry for transient errors
  const attempts = 2;
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const { res, text, json } = await postJSON(endpoint, payload);

      // Your Apps Script must return JSON like: { ok: true, rowNumber: N }
      if (res.ok && json && json.ok === true) {
        return json; // { ok: true, rowNumber?: number, ... }
      }

      const bodyPreview = (text || "").slice(0, 300);
      const hint = json
        ? `JSON received without ok=true: ${JSON.stringify(json)}`
        : `Non-JSON body: "${bodyPreview}"`;
      throw new Error(
        `Sheets append failed: HTTP ${res.status}. ${hint}. ` +
          `Ensure your Apps Script returns JSON: {"ok":true,"rowNumber":n}`,
      );
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

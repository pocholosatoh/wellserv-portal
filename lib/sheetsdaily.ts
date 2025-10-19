// lib/sheetsdaily.ts
export type RunningRow = {
  patient_id: string;
  full_name: string;          // "SURNAME, FIRSTNAME" (ALL CAPS)
  age?: string;               // leave "" so the sheet computes
  sex: "M" | "F";
  birthday: string;           // MM/DD/YYYY
  contact?: string;
  address?: string;
  date_of_test?: string;      // MM/DD/YYYY (defaults to Manila today)
  notes?: string;             // comma-separated tests
};

function manilaTodayMMDDYYYY(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.APP_TZ || "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit"
  });
  const parts = fmt.formatToParts(new Date());
  const mm = parts.find(p => p.type === "month")?.value ?? "01";
  const dd = parts.find(p => p.type === "day")?.value ?? "01";
  const yy = parts.find(p => p.type === "year")?.value ?? "1970";
  return `${mm}/${dd}/${yy}`;
}

export async function appendRunningRow(branchCode: "SI" | "SL", row: RunningRow) {
  const endpoint = process.env.APPS_SCRIPT_ENDPOINT!;
  const token = process.env.APPS_SCRIPT_TOKEN!;
  const tab = process.env.RUNNING_SHEET_TAB || "Results";
  const sheetId =
    branchCode === "SI" ? process.env.SI_RUNNING_SHEET_ID : process.env.SL_RUNNING_SHEET_ID;

  if (!endpoint || !token || !sheetId) {
    throw new Error("Missing Apps Script env (endpoint/token/sheetId).");
  }

  const payload = {
    token,
    sheetId,
    tab,
    row: {
      ...row,
      age: row.age ?? "", // let sheet formula compute
      date_of_test: row.date_of_test || manilaTodayMMDDYYYY(),
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let j: any = {};
  try { j = await res.json(); } catch {}
  if (!res.ok || !j?.ok) throw new Error(j?.error || `Sheets append failed (${res.status})`);
  return j; // { ok: true, rowNumber: n }
}

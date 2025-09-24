// lib/google.ts
import { google } from "googleapis";
import { ENV } from "./env";

export async function getSheets() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

  const auth = new google.auth.JWT({
    email: ENV.GOOGLE_CLIENT_EMAIL,
    key: ENV.GOOGLE_PRIVATE_KEY,
    scopes,
  });

  return google.sheets({ version: "v4", auth });
}

/** If given just the tab name, make it "Tab!A:ZZ". If already has '!', return as-is. */
export function normalizeRange(input: string): string {
  const base = input.trim();
  if (!base) throw new Error("Empty SHEET_RANGE after normalization");
  return base.includes("!") ? base : `${base}!A:ZZ`;
}

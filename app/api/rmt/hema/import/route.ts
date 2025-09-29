import { NextResponse } from "next/server";
import { google } from "googleapis";
import {
  sanitizeHemaRows,
  assertHemaHeaders,
  toSheetRow,
  OUTPUT_ORDER,
} from "@/lib/hema";
import { resolveSpreadsheetId, getTabNameForBranch } from "@/lib/branches";

// ---------- SECRET CHECK ----------
function requireSecretOrThrow(secretFromBody?: string) {
  const expected = process.env.RMT_UPLOAD_SECRET || process.env.NEXT_PUBLIC_RMT_UPLOAD_SECRET;
  if (!expected) return;
  if (!secretFromBody || secretFromBody !== expected) {
    throw new Error("Unauthorized: bad or missing secret");
  }
}

// ---------- GOOGLE CLIENT ----------
async function getSheetsClient() {
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey =
    process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  const privateKeyB64 =
    process.env.GOOGLE_PRIVATE_KEY_B64 || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64;

  if (!privateKey && privateKeyB64) {
    try { privateKey = Buffer.from(privateKeyB64, "base64").toString("utf8"); } catch {}
  }
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing service account envs. Set GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY " +
      "or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }
  privateKey = privateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function columnLetter(n: number) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - m) / 26); }
  return s;
}

async function fetchSpreadsheetMeta(sheets: any, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitles: string[] = meta.data.sheets?.map((s: any) => s.properties?.title).filter(Boolean) || [];
  return { sheetTitles };
}

// ---------- ROUTE ----------
export async function POST(req: Request) {
  let resolvedSpreadsheetId = "";
  let tabName = "Database";
  try {
    const body = await req.json().catch(() => ({}));
    // Accept either:
    // - sheetKey: "SI" | "SL" | "GC" | "SI_RUNNING_SHEET_ID" | raw ID | full URL
    // - OR branch: "SI" | "SL" | "GC"
    const { sheetKey, branch, rows, secret, sheetName } = body || {};

    if (!sheetKey && !branch) {
      return NextResponse.json({ ok: false, error: "Missing sheetKey or branch" }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No rows to import" }, { status: 400 });
    }

    //requireSecretOrThrow(secret);

    const key = String(sheetKey || branch);
    resolvedSpreadsheetId = resolveSpreadsheetId(key);
    tabName = String(sheetName || getTabNameForBranch(key));

    const sheets = await getSheetsClient();

    // 1) Validate spreadsheet exists & list tabs
    let tabs: string[] = [];
    try {
      const meta = await fetchSpreadsheetMeta(sheets, resolvedSpreadsheetId);
      tabs = meta.sheetTitles;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Spreadsheet not found or no access. Confirm the ID/URL and share the sheet with your service account email.",
          resolvedSpreadsheetId,
          hint:
            "Open the sheet → Share → add the service-account email as Editor.",
        },
        { status: 404 }
      );
    }

    // 2) Validate tab exists
    if (!tabs.includes(tabName)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Tab '${tabName}' not found in spreadsheet.`,
          availableTabs: tabs,
          resolvedSpreadsheetId,
        },
        { status: 404 }
      );
    }

    // 3) Read header + data
    const getResp = await sheets.spreadsheets.values.get({
      spreadsheetId: resolvedSpreadsheetId,
      range: `${tabName}!1:1000000`,
    });
    const sheetData = (getResp.data.values || []) as string[][];
    if (sheetData.length === 0) {
      return NextResponse.json(
        { ok: false, error: `Sheet '${tabName}' is empty`, resolvedSpreadsheetId },
        { status: 400 }
      );
    }

    const headers = (sheetData[0] || []).map((s) => String(s || "").trim());

    // 4) Ensure required headers exist (patient_id + all hema_* cols)
    try {
      assertHemaHeaders(headers);
    } catch (e: any) {
      const msg = String(e?.message || "");
      const missing =
        msg.startsWith("Missing headers in sheet:")
          ? msg.replace("Missing headers in sheet:", "")
              .split(",").map((s) => s.trim()).filter(Boolean)
          : ["(unknown header error)"];
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required headers in sheet",
          missingHeaders: missing,
          resolvedSpreadsheetId,
          tabName,
        },
        { status: 400 }
      );
    }

    // Build index map header -> column index
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => { idx[h] = i; });

    // 5) Normalize CSV -> internal -> sheet row objects (keys match headers we want to write)
    const internalRows = sanitizeHemaRows(rows);
    const sheetRows = internalRows.map((r) => toSheetRow(r)); // { patient_id, hema_wbc, ... }

    // Safety: verify every header in OUTPUT_ORDER exists in idx
    const missingInIdx = OUTPUT_ORDER.filter((h) => !(h in idx));
    if (missingInIdx.length) {
      return NextResponse.json(
        { ok: false, error: `Headers not found in sheet: ${missingInIdx.join(", ")}`, resolvedSpreadsheetId, tabName },
        { status: 400 }
      );
    }

    // patient_id position
    const pidColIdx = idx["patient_id"];
    if (pidColIdx == null) {
      return NextResponse.json(
        { ok: false, error: "Sheet missing 'patient_id' column", resolvedSpreadsheetId, tabName },
        { status: 400 }
      );
    }

    // Build map of existing patient_id -> 1-based row index
    const existingMap = new Map<string, number>();
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i] || [];
      const pid = String(row[pidColIdx] || "").trim();
      if (pid) existingMap.set(pid, i + 1); // +1 header row
    }

    // We will update/append FULL-WIDTH rows from column A to the last header column to avoid misalignment
    const lastHeaderColIdx = headers.length - 1;
    const rowRangeFromA = (rowNumber1Based: number) =>
      `${tabName}!A${rowNumber1Based}:${columnLetter(lastHeaderColIdx + 1)}${rowNumber1Based}`;

    // Prepare writes
    const updates: Array<{ range: string; values: any[][] }> = [];
    const inserts: any[][] = [];

    for (const sr of sheetRows) {
      const pid = String(sr.patient_id || "").trim();
      if (!pid) continue;

      // Build a full-width row aligned to headers; for updates, prefill with existing row to preserve other columns
      const existingRowIndex = existingMap.get(pid);
      let current: string[] = [];
      if (existingRowIndex) {
        current = sheetData[existingRowIndex - 1] || [];
      }
      const fullRow = new Array(headers.length).fill("");
      for (let c = 0; c < headers.length; c++) {
        // prefill to preserve untouched columns
        fullRow[c] = current[c] ?? "";
      }

      // Set target columns at their exact header indices
      for (const headerName of OUTPUT_ORDER) {
        const col = idx[headerName];
        fullRow[col] = (sr as any)[headerName] ?? "";
      }

      if (existingRowIndex) {
        updates.push({ range: rowRangeFromA(existingRowIndex), values: [fullRow] });
      } else {
        inserts.push(fullRow);
      }
    }

    // 6) Write
    let updatedRows = 0;
    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: resolvedSpreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates.map((u) => ({ range: u.range, values: u.values })),
        },
      });
      updatedRows += updates.length;
    }
    if (inserts.length) {
      const startA1 = `${tabName}!A${sheetData.length + 1}`;
      await sheets.spreadsheets.values.append({
        spreadsheetId: resolvedSpreadsheetId,
        range: startA1,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: inserts },
      });
      updatedRows += inserts.length;
    }

    return NextResponse.json({
      ok: true,
      updatedRows,
      resolvedSpreadsheetId,
      tabName,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message || err || "Unknown error"),
        resolvedSpreadsheetId,
        tabName,
      },
      { status: 500 }
    );
  }
}

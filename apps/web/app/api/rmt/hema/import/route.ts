// app/api/rmt/hema/import/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { sanitizeHemaRows, assertHemaHeaders, toSheetRow, OUTPUT_ORDER } from "@/lib/hema";
import { resolveSpreadsheetId, getTabNameForBranch } from "@/lib/branches";
import { checkRateLimit, getRequestIp } from "@/lib/auth/rateLimit";

// Only write these columns for existing rows (skip patient_id so we don't overwrite it)
const WRITE_HEADERS = OUTPUT_ORDER.filter((h) => h !== "patient_id");

// ----- secret check -----
function requireSecretOrThrow(secretFromBody?: string) {
  const expected = process.env.RMT_UPLOAD_SECRET || process.env.NEXT_PUBLIC_RMT_UPLOAD_SECRET;
  if (!expected) return;
  if (!secretFromBody || secretFromBody !== expected) {
    throw new Error("Unauthorized: bad or missing secret");
  }
}

type SheetTab = { title: string; sheetId: number };

// ----- Google Sheets client -----
async function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  const privateKeyB64 =
    process.env.GOOGLE_PRIVATE_KEY_B64 || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64;

  if (!privateKey && privateKeyB64) {
    try {
      privateKey = Buffer.from(privateKeyB64, "base64").toString("utf8");
    } catch {}
  }
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing service account envs. Set GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY " +
        "or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
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
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

async function fetchSpreadsheetMeta(
  sheets: any,
  spreadsheetId: string,
): Promise<{ tabs: SheetTab[] }> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs: SheetTab[] =
    meta.data.sheets
      ?.map((s: any) => ({
        title: s.properties?.title as string,
        sheetId: s.properties?.sheetId as number,
      }))
      .filter((x: SheetTab) => !!x.title && typeof x.sheetId === "number") || [];
  return { tabs };
}

// ----- ROUTE -----
export async function POST(req: Request) {
  let resolvedSpreadsheetId = "";
  let tabName = "Database";

  try {
    const ip = getRequestIp(req);
    const rateKey = `public:rmt-hema-import:${ip}`;
    const limited = await checkRateLimit({ key: rateKey, limit: 30, windowMs: 60 * 1000 });
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({}));
    // Accept either: sheetKey ("SI" | "SL" | "GC" | env name | raw ID | URL) OR branch ("SI" | "SL" | "GC")
    const { sheetKey, branch, rows, secret, sheetName } = body || {};

    if (!sheetKey && !branch) {
      return NextResponse.json({ ok: false, error: "Missing sheetKey or branch" }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No rows to import" }, { status: 400 });
    }

    requireSecretOrThrow(secret);

    const key = String(sheetKey || branch);
    resolvedSpreadsheetId = resolveSpreadsheetId(key);
    tabName = String(sheetName || getTabNameForBranch(key));

    const sheets = await getSheetsClient();

    // 1) spreadsheet + tab exist?
    let tabTitles: string[] = [];
    try {
      const { tabs } = await fetchSpreadsheetMeta(sheets, resolvedSpreadsheetId);
      tabTitles = tabs.map((t: SheetTab) => t.title);
      if (!tabTitles.includes(tabName)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Tab '${tabName}' not found in spreadsheet.`,
            availableTabs: tabTitles,
            resolvedSpreadsheetId,
          },
          { status: 404 },
        );
      }
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Spreadsheet not found or no access. Share the sheet with your service-account email.",
          resolvedSpreadsheetId,
        },
        { status: 404 },
      );
    }

    // 2) read header + data
    const getResp = await sheets.spreadsheets.values.get({
      spreadsheetId: resolvedSpreadsheetId,
      range: `${tabName}!1:1000000`,
    });
    const sheetData = (getResp.data.values || []) as string[][];
    if (sheetData.length === 0) {
      return NextResponse.json(
        { ok: false, error: `Sheet '${tabName}' is empty`, resolvedSpreadsheetId },
        { status: 400 },
      );
    }

    const headers = (sheetData[0] || []).map((s) => String(s || "").trim());

    // 3) required headers present?
    try {
      assertHemaHeaders(headers); // patient_id + all hema_*
    } catch (e: any) {
      const msg = String(e?.message || "");
      const missing = msg.startsWith("Missing headers in sheet:")
        ? msg
            .replace("Missing headers in sheet:", "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : ["(unknown header error)"];
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required headers in sheet",
          missingHeaders: missing,
          resolvedSpreadsheetId,
          tabName,
        },
        { status: 400 },
      );
    }

    // 4) header index
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => {
      idx[h] = i;
    });
    const pidColIdx = idx["patient_id"];
    if (pidColIdx == null) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sheet missing 'patient_id' column",
          resolvedSpreadsheetId,
          tabName,
        },
        { status: 400 },
      );
    }

    // 5) csv -> normalized -> sheet-row objects
    const internalRows = sanitizeHemaRows(rows);
    const sheetRows = internalRows.map((r) => toSheetRow(r)); // { patient_id, hema_* }

    // 6) existing patient_id map
    const existingMap = new Map<string, number>(); // pid -> 1-based row index
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i] || [];
      const pid = String(row[pidColIdx] || "").trim();
      if (pid) existingMap.set(pid, i + 1); // +1 (header is row 1)
    }

    // 7) cell-level updates for existing, and full-width arrays (aligned to headers) for inserts
    const perCellUpdates: Array<{ range: string; values: any[][] }> = [];
    const insertsFullWidth: any[][] = [];
    let updatedExisting = 0;
    let appended = 0;

    for (const sr of sheetRows) {
      const pid = String(sr.patient_id || "").trim();
      if (!pid) continue;

      const existingRowIndex = existingMap.get(pid);

      if (existingRowIndex) {
        // update hema_* cells only
        for (const h of WRITE_HEADERS) {
          const col = idx[h];
          if (col == null) continue;
          const a1 = `${tabName}!${columnLetter(col + 1)}${existingRowIndex}`;
          perCellUpdates.push({
            range: a1,
            values: [[(sr as any)[h] ?? ""]],
          });
        }
        updatedExisting += 1;
      } else {
        // build a full-width row: blanks everywhere, set patient_id + hema_*
        const rowArr = new Array(headers.length).fill("");
        if (pidColIdx != null) rowArr[pidColIdx] = pid;
        for (const h of WRITE_HEADERS) {
          const col = idx[h];
          if (col != null) {
            rowArr[col] = (sr as any)[h] ?? "";
          }
        }
        insertsFullWidth.push(rowArr);
      }
    }

    // 8) batch update existing cells
    if (perCellUpdates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: resolvedSpreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: perCellUpdates.map((u) => ({ range: u.range, values: u.values })),
        },
      });
    }

    // 9) append new rows (full width, aligned to headers; no formulas copied)
    if (insertsFullWidth.length) {
      const startA1 = `${tabName}!A${sheetData.length + 1}`;
      await sheets.spreadsheets.values.append({
        spreadsheetId: resolvedSpreadsheetId,
        range: startA1,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: insertsFullWidth },
      });
      appended = insertsFullWidth.length;
    }

    return NextResponse.json({
      ok: true,
      updatedExisting,
      appended,
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
      { status: 500 },
    );
  }
}

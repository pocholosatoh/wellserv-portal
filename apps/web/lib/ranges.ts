import { google } from "googleapis";
import { JWT } from "google-auth-library";

type Row = Record<string, string | null>;

export type RangeRule = {
  analyte_key: string;
  label?: string;
  section?: "hema" | "chem" | "ua" | "fa" | "sero" | string;
  unit?: string;
  type?: "numeric" | "categorical" | "scale" | "text" | string;
  decimals?: number;
  sex?: "male" | "female" | "any" | string;
  low?: number | null;
  high?: number | null;
  normal_values?: string[];
  scale_order?: string[];
};

export type ConfigKV = Record<string, string>;

const TTL_MS = 5 * 60 * 1000;
let cacheRanges: { at: number; rulesByKey: Map<string, RangeRule[]> } | null = null;
let cacheConfig: { at: number; kv: ConfigKV } | null = null;

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function getSheets() {
  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const auth = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

function toNum(x: any): number | null {
  if (x == null) return null;
  const s = String(x).trim();
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function splitList(x: any): string[] {
  return String(x ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function normToken(x: string) {
  return x.trim().toLowerCase();
}

export async function loadRanges(): Promise<Map<string, RangeRule[]>> {
  const now = Date.now();
  if (cacheRanges && now - cacheRanges.at < TTL_MS) return cacheRanges.rulesByKey;

  const sheets = await getSheets();
  const sheetId = env("SHEET_ID");
  const range = process.env.SHEET_RANGES || "Ranges!1:1000";
  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });

  const values = data.values ?? [];
  const [hdr = [], ...rows] = values;
  const H = hdr.map((h) => String(h).trim().toLowerCase());

  const idx = (name: string) => H.indexOf(name);
  const rulesByKey = new Map<string, RangeRule[]>();

  for (const r of rows) {
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? (r[i] ?? "").toString().trim() : "";
    };

    const analyte_key = get("analyte_key");
    if (!analyte_key) continue;

    const rule: RangeRule = {
      analyte_key,
      label: get("label") || undefined,
      section: (get("section") || undefined) as any,
      unit: get("unit") || undefined,
      type: (get("type") || "text") as any,
      decimals: toNum(get("decimals")) ?? undefined,
      sex: (get("sex") || "any") as any,
      low: toNum(get("low")),
      high: toNum(get("high")),
      normal_values: splitList(get("normal_values")),
      scale_order: splitList(get("scale_order")),
    };

    const list = rulesByKey.get(analyte_key) || [];
    list.push(rule);
    rulesByKey.set(analyte_key, list);
  }

  cacheRanges = { at: now, rulesByKey };
  return rulesByKey;
}

export async function loadConfig(): Promise<ConfigKV> {
  const now = Date.now();
  if (cacheConfig && now - cacheConfig.at < TTL_MS) return cacheConfig.kv;

  const sheets = await getSheets();
  const sheetId = env("SHEET_ID");
  const range = process.env.SHEET_CONFIG || "Config!A:B";
  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });

  const kv: ConfigKV = {};
  for (const row of data.values ?? []) {
    const [k, v] = row;
    if (!k) continue;
    kv[String(k).trim()] = String(v ?? "").trim();
  }
  cacheConfig = { at: now, kv };
  return kv;
}

// -------- evaluation helpers (Option B policy baked in) --------

export type EvalResult = {
  value: string;
  label: string;
  unit?: string;
  flag: "H" | "L" | "A" | null;
  low?: number | null;
  high?: number | null;
};

function pickRule(rules: RangeRule[] | undefined, sex: string | null): RangeRule | undefined {
  if (!rules || rules.length === 0) return undefined;
  const sx = (sex || "any").toLowerCase();
  // prefer sex-specific, fallback to 'any'
  return (
    rules.find((r) => (r.sex || "any").toLowerCase() === sx) ||
    rules.find((r) => (r.sex || "any") === "any") ||
    rules[0]
  );
}

function extractUpperNumeric(raw: string): number | null {
  if (!raw) return null;
  // find all numbers; use the max as upper endpoint (handles "0-2", "3–5", "≤2")
  const nums = [...raw.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]));
  if (nums.length === 0 || nums.some((n) => Number.isNaN(n))) return null;
  return Math.max(...nums);
}

export function evaluateValue(
  rulesByKey: Map<string, RangeRule[]>,
  analyte_key: string,
  rawValue: string | null | undefined,
  sex: "male" | "female" | "any" | string = "any",
): EvalResult | null {
  const raw = String(rawValue ?? "").trim();
  const rules = rulesByKey.get(analyte_key);
  const rule = pickRule(rules, sex);
  if (!rule) return null;

  const label =
    rule.label || analyte_key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (rule.type === "numeric") {
    const n = extractUpperNumeric(raw);
    if (n == null)
      return { value: raw, label, unit: rule.unit, flag: null, low: rule.low, high: rule.high };
    if (rule.high != null && n > rule.high)
      return { value: raw, label, unit: rule.unit, flag: "H", low: rule.low, high: rule.high };
    if (rule.low != null && n < rule.low)
      return { value: raw, label, unit: rule.unit, flag: "L", low: rule.low, high: rule.high };
    return { value: raw, label, unit: rule.unit, flag: null, low: rule.low, high: rule.high };
  }

  if (rule.type === "categorical") {
    const normals = rule.normal_values ?? [];
    if (normals.length === 0) {
      // display only
      return { value: raw, label, unit: rule.unit, flag: null };
    }
    const token = normToken(raw);
    const ok = normals.includes(token);
    return { value: raw, label, unit: rule.unit, flag: ok ? null : "A" };
  }

  if (rule.type === "scale") {
    const order = rule.scale_order ?? [];
    const normals = rule.normal_values ?? [];
    if (order.length === 0) {
      // behave like categorical with Option B fallback
      if (normals.length === 0) return { value: raw, label, unit: rule.unit, flag: null };
      const ok = normals.includes(normToken(raw));
      return { value: raw, label, unit: rule.unit, flag: ok ? null : "A" };
    }
    // Option B: if no normals -> NO FLAGGING
    if (normals.length === 0) return { value: raw, label, unit: rule.unit, flag: null };

    const idx = order.indexOf(normToken(raw));
    if (idx < 0) {
      // unknown token → if we have normals, treat as abnormal; else (already handled) no flag
      return { value: raw, label, unit: rule.unit, flag: "A" };
    }
    // highest acceptable = max index among normals in scale
    const normalIdx = Math.max(...normals.map((n) => order.indexOf(n)).filter((i) => i >= 0));
    const flag = idx > normalIdx ? "A" : null;
    return { value: raw, label, unit: rule.unit, flag };
  }

  // text: display only
  return { value: raw, label, unit: rule.unit, flag: null };
}

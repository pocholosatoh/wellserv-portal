import { SupabaseClient } from "@supabase/supabase-js";

export type LabRangeInfo = {
  low?: number;
  high?: number;
  label?: string;
  unit?: string;
};
export type LabRangeMap = Map<string, LabRangeInfo>;

const normalizeNumber = (val: any): number | null => {
  if (val == null) return null;
  const str = String(val).replace(/[^\d.-]/g, "").trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
};

export function normalizeLabKey(lab: Record<string, any>): string | null {
  const key =
    lab.analyte_key ||
    lab.key ||
    lab.analyte ||
    null;
  return key ? String(key).trim().toLowerCase() : null;
}

export async function buildLabRangeMap(db: SupabaseClient): Promise<LabRangeMap> {
  const { data, error } = await db.from("ranges").select("*");
  if (error) throw error;
  const map: LabRangeMap = new Map();
  for (const row of data || []) {
    const key =
      row.analyte_key ||
      row.key ||
      row.parameter_key ||
      row.param_key ||
      null;
    if (!key) continue;
    const low = normalizeNumber(row.low);
    const high = normalizeNumber(row.high);
    map.set(String(key).trim().toLowerCase(), {
      low: low ?? undefined,
      high: high ?? undefined,
      label: row.label || row.name || row.display_name || undefined,
      unit: row.unit || row.units || undefined,
    });
  }
  return map;
}

export function deriveLabFlag(
  lab: Record<string, any>,
  rangeMap: LabRangeMap
): "H" | "L" | "A" | null {
  const rawFlag =
    lab?.flag ||
    lab?.flag_status ||
    lab?.flag_text ||
    lab?.flag_slug ||
    null;
  if (rawFlag) {
    const f = String(rawFlag).trim().toUpperCase();
    if (f === "H" || f === "L" || f === "A") return f;
    if (f === "HIGH") return "H";
    if (f === "LOW") return "L";
    if (f.startsWith("ABN") || f === "ALERT") return "A";
  }

  const key = normalizeLabKey(lab);
  if (!key) return null;
  const range = rangeMap.get(key);
  if (!range) return null;
  const valueNum = normalizeNumber(
    lab.value ?? lab.result ?? lab.val ?? lab.numeric_value ?? null
  );
  if (valueNum == null) return null;
  if (range.high != null && valueNum > range.high) return "H";
  if (range.low != null && valueNum < range.low) return "L";
  return null;
}

export function formatLabEntrySummary(
  lab: Record<string, any>,
  flag: "H" | "L" | "A" | null,
  rangeMap?: LabRangeMap
): string | null {
  const key = normalizeLabKey(lab);
  const rangeInfo = key ? rangeMap?.get(key) : null;
  const labelBase =
    rangeInfo?.label ||
    lab.analyte_key ||
    lab.analyte ||
    lab.barcode ||
    "Lab";
  const rawValue = lab.value ?? lab.result ?? lab.val ?? lab.numeric_value ?? "";
  let valueStr = String(rawValue ?? "").trim();
  if (!valueStr || valueStr === "-" || valueStr.toLowerCase() === "negative") {
    return null;
  }
  const numericVal = normalizeNumber(valueStr);
  if (numericVal != null) {
    const fixed = numericVal.toFixed(2);
    valueStr = fixed.replace(/\.?0+$/, "");
  }
  const unitRaw = lab.unit ?? lab.units ?? lab.uom ?? rangeInfo?.unit ?? "";
  const unit = unitRaw ? ` ${unitRaw}` : "";
  const flagWord = flag === "H" ? "High" : flag === "L" ? "Low" : flag === "A" ? "Alert" : "";
  const flagSuffix = flagWord ? ` (${flagWord})` : "";
  return `${labelBase}: ${valueStr}${unit}${flagSuffix}`.trim();
}

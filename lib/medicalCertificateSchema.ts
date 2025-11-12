// lib/medicalCertificateSchema.ts
export const PHYSICAL_EXAM_SECTIONS = [
  { key: "general", label: "General Survey" },
  { key: "heent", label: "HEENT" },
  { key: "chest", label: "Chest / Lungs" },
  { key: "heart", label: "Heart" },
  { key: "abdomen", label: "Abdomen" },
  { key: "extremities", label: "Extremities" },
  { key: "neuro", label: "Neurologic" },
  { key: "skin", label: "Skin" },
] as const;

export type PhysicalExamKey = (typeof PHYSICAL_EXAM_SECTIONS)[number]["key"];
export type PhysicalExamEntry = {
  status: "normal" | "abnormal";
  remarks: string;
};
export type PhysicalExamPayload = Record<PhysicalExamKey, PhysicalExamEntry>;

export type SupportingDataEntry = {
  id?: string | null;
  type: string;
  label: string;
  summary: string;
  source_id?: string | null;
  payload?: Record<string, any> | null;
};

export function createDefaultPhysicalExam(): PhysicalExamPayload {
  return PHYSICAL_EXAM_SECTIONS.reduce<PhysicalExamPayload>((acc, section) => {
    acc[section.key] = { status: "normal", remarks: "" };
    return acc;
  }, {} as PhysicalExamPayload);
}

export function normalizePhysicalExam(input: any): PhysicalExamPayload {
  const base = createDefaultPhysicalExam();
  if (!input || typeof input !== "object") return base;

  for (const { key } of PHYSICAL_EXAM_SECTIONS) {
    const value = input[key];
    if (!value || typeof value !== "object") continue;
    const status = String(value.status || "").toLowerCase();
    const remarks = typeof value.remarks === "string" ? value.remarks : "";
    if (status === "abnormal") {
      base[key] = { status: "abnormal", remarks };
    } else {
      base[key] = { status: "normal", remarks };
    }
  }
  return base;
}

export function summarizeVitals(row?: Record<string, any> | null): string | null {
  if (!row) return null;
  const parts: string[] = [];
  if (row.systolic_bp && row.diastolic_bp) {
    parts.push(`BP ${row.systolic_bp}/${row.diastolic_bp} mmHg`);
  }
  if (row.hr) parts.push(`HR ${row.hr} bpm`);
  if (row.rr) parts.push(`RR ${row.rr}/min`);
  if (row.temp_c) parts.push(`Temp ${Number(row.temp_c).toFixed(1)}°C`);
  if (row.o2sat) parts.push(`SpO₂ ${row.o2sat}%`);
  if (row.weight_kg && row.height_cm) {
    parts.push(`Weight ${row.weight_kg}kg / Height ${row.height_cm}cm`);
  } else if (row.weight_kg) {
    parts.push(`Weight ${row.weight_kg}kg`);
  }
  if (row.bmi) {
    const bmiVal = Number(row.bmi);
    if (!Number.isNaN(bmiVal)) {
      parts.push(`BMI ${bmiVal.toFixed(1)}`);
    }
  }
  if (!parts.length) return null;
  return parts.join(", ");
}

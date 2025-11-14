import { z } from "zod";

export const patientSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  birthDate: z.string().optional(),
  lastVisit: z.string().optional(),
});

export type Patient = z.infer<typeof patientSchema>;

export const labResultSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  name: z.string(),
  collectedAt: z.string(),
  pdfUrl: z.string().url().optional(),
  summary: z.string().optional(),
});

export type LabResult = z.infer<typeof labResultSchema>;

const prescriptionItemSchema = z.object({
  drug: z.string(),
  sig: z.string(),
});

export const prescriptionSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  issuedAt: z.string(),
  items: z.array(prescriptionItemSchema),
});

export type Prescription = z.infer<typeof prescriptionSchema>;

export type SessionToken = {
  patientId: string;
  accessCode: string;
};

export function formatShortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function getInitials(name?: string) {
  if (!name) return "";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

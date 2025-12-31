import { z } from "zod";

export const Category = z.enum(["imaging", "cytology", "microbiology", "ecg", "in_vitro", "other"]);

export const PresignRequest = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1),
        contentType: z.string().min(1),
      }),
    )
    .min(1),
  patient_id: z.string().min(1),
  encounter_id: z.string().uuid().nullable().optional(),
  category: Category,
  subtype: z.string().nullable().optional(), // e.g., 'CXR_PA', 'ECG_12LEAD'; free for in_vitro
  taken_at: z.string().min(1), // 'YYYY-MM-DD'
  provider: z.string().min(1),
  impression: z.string().optional(), // required except ECG (UI enforces)
  performer_name: z.string().optional(),
  performer_role: z.string().optional(),
  performer_license: z.string().optional(),
  note: z.string().optional(),
});

export type PresignRequestT = z.infer<typeof PresignRequest>;

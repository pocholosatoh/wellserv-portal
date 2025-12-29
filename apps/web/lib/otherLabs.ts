import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type OtherLabsItem = {
  id: string;
  patient_id: string;
  url: string;
  content_type: string | null;
  type: string | null;
  provider?: string | null;
  taken_at?: string | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  note?: string | null;
  category?: string | null;
  subtype?: string | null;
  impression?: string | null;
  reported_at?: string | null;
  performer_name?: string | null;
  performer_role?: string | null;
  performer_license?: string | null;
  encounter_id?: string | null;
};

const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_PATIENT_BUCKET?.trim() || "patient-files";

export function getOtherLabsBucket() {
  return DEFAULT_BUCKET;
}

export function getOtherLabsExpiry(sp: URLSearchParams) {
  const n = Number(sp.get("expires"));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 60 * 60 * 4) : 1800;
}

export async function fetchOtherLabsForPatient(
  patientId: string,
  opts: { expiresIn?: number; bucket?: string } = {}
): Promise<OtherLabsItem[]> {
  const sb = supabaseAdmin();
  const bucket = opts.bucket || DEFAULT_BUCKET;
  const expiresIn = opts.expiresIn ?? 1800;
  const { data, error } = await sb
    .from("external_results")
    .select(
      "id, patient_id, url, content_type, type, provider, taken_at, uploaded_at, uploaded_by, note, category, subtype, impression, reported_at, performer_name, performer_role, performer_license, encounter_id"
    )
    .eq("patient_id", patientId)
    .order("type", { ascending: true })
    .order("taken_at", { ascending: false })
    .order("uploaded_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as OtherLabsItem[];

  const items = await Promise.all(
    rows.map(async (r) => {
      if (/^https?:\/\//i.test(r.url)) return r;
      const { data: signed, error: signErr } = await sb
        .storage
        .from(bucket)
        .createSignedUrl(r.url, expiresIn);
      if (signErr || !signed?.signedUrl) {
        throw new Error(
          `[sign-error] bucket="${bucket}" path="${r.url}" :: ${signErr?.message || "cannot sign"}`
        );
      }
      return { ...r, url: signed.signedUrl };
    })
  );

  return items;
}

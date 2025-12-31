import { getSupabaseServer } from "@/lib/supabaseServer";

/** Returns a signed, time-limited URL (default 30 min) for a private storage path. */
export async function getSignedUrl(path: string, expiresInSec = 1800) {
  const supa = getSupabaseServer();
  const { data, error } = await supa.storage
    .from("patient-files")
    .createSignedUrl(path, expiresInSec);

  if (error || !data?.signedUrl) {
    throw new Error(`Cannot sign file ${path}: ${error?.message || "unknown error"}`);
  }
  return data.signedUrl;
}

// lib/medicalCertificates.ts
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function generateCertificateNo(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = randomUUID().split("-")[0].toUpperCase();
  return `MC-${y}${m}${d}-${rand}`;
}

export function generateQrToken(): string {
  return randomUUID().replace(/-/g, "");
}

export function generateVerificationCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

export async function signDoctorSignature(
  sb: SupabaseClient,
  key?: string | null,
): Promise<string | null> {
  if (!key) return null;
  if (typeof key !== "string") {
    try {
      const maybe = (key as any)?.signedUrl ?? (key as any)?.url ?? (key as any)?.path ?? null;
      if (maybe && typeof maybe === "string") key = maybe;
    } catch {
      /* ignore */
    }
  }
  if (!key || typeof key !== "string") return null;
  if (/^https?:\/\//i.test(key)) return key;

  try {
    const { data, error } = await sb.storage
      .from("dr_signatures")
      .createSignedUrl(key, 60 * 60 * 12);
    if (error) {
      console.warn("[med-cert] signature sign error", error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (err) {
    console.warn("[med-cert] signature sign exception", err);
    return null;
  }
}

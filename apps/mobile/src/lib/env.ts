import Constants from "expo-constants";

const extra = (Constants?.expoConfig?.extra || {}) as Record<string, string | undefined>;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || "";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || "";
export const PATIENT_ACCESS_CODE =
  process.env.EXPO_PUBLIC_PATIENT_ACCESS_CODE || extra.patientAccessCode || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase environment variables are missing");
}

import Constants from "expo-constants";

const extra = (Constants?.expoConfig?.extra || {}) as Record<string, string | undefined>;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || "";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || "";
export const PATIENT_ACCESS_CODE =
  process.env.EXPO_PUBLIC_PATIENT_ACCESS_CODE || extra.patientAccessCode || "";
export const WEB_API_BASE_URL = (
  process.env.EXPO_PUBLIC_WEB_API_BASE_URL ||
  process.env.EXPO_PUBLIC_WEB_APP_URL ||
  process.env.EXPO_PUBLIC_SITE_URL ||
  extra.webApiBaseUrl ||
  extra.webAppUrl ||
  ""
).replace(/\/$/, "");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase environment variables are missing");
}

if (!WEB_API_BASE_URL) {
  console.warn(
    "WEB_API_BASE_URL is missing. Set EXPO_PUBLIC_WEB_API_BASE_URL to your web API base URL (e.g. https://your-site.vercel.app or http://192.168.X.X:3000)."
  );
}

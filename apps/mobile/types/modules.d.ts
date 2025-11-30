declare module "@supabase/supabase-js" {
  export type SupabaseClient = any;
  export type SupabaseClientOptions = any;
  export function createClient(...args: any[]): SupabaseClient;
}

declare module "expo-secure-store";

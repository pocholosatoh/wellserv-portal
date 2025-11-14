import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserStorageAdapter } from "./storage/BrowserStorageAdapter";
import type { StorageAdapter } from "./types";

export type ClientPlatform = "web" | "native";

export type SupabaseClientOptions = {
  supabaseUrl: string;
  supabaseKey: string;
  platform?: ClientPlatform;
  storage?: StorageAdapter;
};

function normalizeAsync<T>(value: Promise<T> | T): Promise<T> {
  return value instanceof Promise ? value : Promise.resolve(value);
}

function toSupabaseStorage(adapter: StorageAdapter) {
  return {
    getItem: (key: string) => normalizeAsync(adapter.getItem(key)),
    setItem: (key: string, value: string) => normalizeAsync(adapter.setItem(key, value)),
    removeItem: (key: string) => normalizeAsync(adapter.removeItem(key)),
  };
}

export function createSupabaseClient({
  supabaseUrl,
  supabaseKey,
  storage,
}: SupabaseClientOptions): SupabaseClient {
  const resolvedStorage = storage ?? createBrowserStorageAdapter();

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: toSupabaseStorage(resolvedStorage),
    },
  });
}

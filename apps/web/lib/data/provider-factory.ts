// lib/data/provider-factory.ts
import type { DataProvider } from "./data-provider";

// lazy imports to avoid pulling both into every route bundle
export async function getDataProvider(): Promise<DataProvider> {
  const backend = (process.env.DATA_BACKEND || "supabase").toLowerCase();

  if (backend === "sheets") {
    const { createSheetsProvider } = await import("./sheets-provider");
    return createSheetsProvider();
  }

  const { createSupabaseProvider } = await import("./supabase-provider");
  return createSupabaseProvider();
}

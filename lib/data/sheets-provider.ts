// lib/data/sheets-provider.ts
import type { DataProvider } from "./data-provider";

export function createSheetsProvider(): DataProvider {
  throw new Error("Sheets provider not implemented in this build. Set DATA_BACKEND=supabase.");
}

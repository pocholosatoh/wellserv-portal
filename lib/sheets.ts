// lib/sheets.ts
// Replace with your real Google Sheets client later.
// For now we just prove the export/import works.

export type Row = Record<string, string>;

export async function readRows(_opts?: { limit?: number }): Promise<Row[]> {
  // Fake rows for wiring tests. We'll hook Google Sheets once routing is stable.
  return [
    { patientId: "P-001", test: "Cholesterol", value: "205", date: "2025-09-01" },
    { patientId: "P-002", test: "Glucose", value: "98", date: "2025-09-02" },
  ];
}

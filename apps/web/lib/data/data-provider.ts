// lib/data/data-provider.ts

// --- Domain shapes returned to the UI (keep these stable) ---
export type Sex = "Male" | "Female" | string;

export interface VitalsSnapshot {
  id: string;
  patient_id: string;
  consultation_id: string;
  encounter_id: string;
  measured_at: string;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  hr?: number | null;
  rr?: number | null;
  temp_c?: number | null;
  height_cm?: number | null;
  weight_kg?: number | string | null;
  bmi?: number | null;
  o2sat?: number | null;
  notes?: string | null;
  source?: string | null;
  created_at?: string | null;
  created_by_initials?: string | null;
}

export interface Patient {
  patient_id: string;
  full_name?: string;
  sex?: Sex;
  age?: number | string;
  birthday?: string;     // ISO date (YYYY-MM-DD) preferred
  contact?: string;
  address?: string;
  email?: string;

  // optional vitals / summary fields (use if you have them)
  height_ft?: number | string;
  height_inch?: number | string;
  weight_kg?: number | string;
  systolic_bp?: number | string;
  diastolic_bp?: number | string;

  last_updated?: string; // ISO datetime
  present_illness_history?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  chief_complaint?: string;
  allergies_text?: string;
  medications_current?: string;
  medications?: string;
  family_history?: string;
  smoking_hx?: string;
  alcohol_hx?: string;
  vitals?: {
    latest?: VitalsSnapshot | null;
    history?: VitalsSnapshot[];
  };
}

export interface Visit {
  date_of_test: string;   // ISO date (YYYY-MM-DD)
  barcode?: string;
  branch?: string;
  notes?: string;
}

export interface ReportItem {
  key: string;            // analyte key (e.g., "hema_wbc")
  label: string;          // display name (e.g., "WBC")
  unit?: string;
  value?: number | string | null;
  ref_low?: number | string | null;
  ref_high?: number | string | null;
  flag?: "L" | "H" | "A" | "N" | null;  // Low/High/Abnormal/Normal (use what you have)
  method?: string | null;
  remarks?: string | null;
}

export interface ReportSection {
  name: string;           // e.g., "Hematology"
  items: ReportItem[];
}

export interface Report {
  patient: Patient;
  visit: Visit;
  sections: ReportSection[];
}

export interface SearchPatientsResult {
  results: Patient[];
  total?: number;
}

export interface Config {
  footer_lines?: string[];
  signatories?: Array<{ role: string; name: string; lic_no?: string }>;
}

// --- Data Provider contract ---
export interface DataProvider {
  getPatient(patient_id: string): Promise<Patient | null>;

  getVisits(patient_id: string): Promise<Visit[]>;

  getReport(opts: { patient_id: string; visitDate?: string }): Promise<Report | null>;

  searchPatients(opts: { query: string; limit?: number; offset?: number }): Promise<SearchPatientsResult>;

  getConfig?(): Promise<Config>;
}

// helpful re-exports elsewhere
export type { ReportItem as AnalyteItem, ReportSection as Section };

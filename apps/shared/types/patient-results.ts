export type ResultFlag = "" | "L" | "H" | "A";

export type ResultReferenceRange = {
  low?: number;
  high?: number;
};

export type ResultItem = {
  key: string;
  label: string;
  value: string;
  unit: string;
  flag: ResultFlag;
  ref?: ResultReferenceRange;
};

export type ResultSection = {
  name: string;
  items: ResultItem[];
};

export type PatientVitalsSnapshot = {
  id: string;
  patient_id: string;
  consultation_id: string;
  encounter_id: string;
  measured_at: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  hr: number | null;
  rr: number | null;
  temp_c: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  o2sat: number | null;
  notes: string;
  source: string;
  created_at: string;
  created_by_initials: string;
};

export type PatientVitals = {
  latest?: PatientVitalsSnapshot | null;
  history?: PatientVitalsSnapshot[];
};

export type PatientSummary = {
  patient_id: string;
  full_name: string;
  age: string;
  sex: string;
  birthday: string;
  contact: string;
  address: string;
  email: string;
  height_ft: string;
  height_inch: string;
  weight_kg: string;
  systolic_bp: string;
  diastolic_bp: string;
  last_updated: string;
  present_illness_history: string;
  past_medical_history: string;
  past_surgical_history: string;
  chief_complaint: string;
  allergies_text: string;
  medications_current: string;
  medications: string;
  family_hx: string;
  family_history: string;
  smoking_hx: string;
  alcohol_hx: string;
  vitals?: PatientVitals;
};

export type VisitSummary = {
  date_of_test: string;
  barcode: string;
  notes: string;
  branch: string;
};

// Report mirrors the JSON returned by adaptReportForUI on the web app.
// - patient: normalized demographics + vitals snapshot
// - visit: one lab visit (date, branch, barcode)
// - sections: grouped result items for that visit
export type Report = {
  patient: PatientSummary;
  visit: VisitSummary;
  sections: ResultSection[];
};

export type PatientResultsResponse = {
  reports: Report[];
  config: any;
  patientOnly?: boolean;
};

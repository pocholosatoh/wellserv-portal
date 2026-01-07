"use client";
import React from "react";
import type { VitalsSnapshot } from "@/lib/data/data-provider";

import StaffNavi from "@/app/staff/_components/StaffNavi";
import { resolveScopedBranch } from "@/lib/staffBranchClient";

const BTN =
  "rounded-xl bg-[#44969b] text-white px-4 py-2 font-medium shadow-card transition-all " +
  "hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#44969b] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";


function toPH(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString("en-PH", { timeZone: "Asia/Manila", hour12: false });
}

type Patient = {
  patient_id: string;
  full_name: string | null;
  age: number | null;
  sex: string | null;
  birthday: string | null;
  contact: string | null;
  address: string | null;
  email: string | null;
  height_ft: number | null;
  height_inch: number | null;
  weight_kg: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  chief_complaint: string | null;
  present_illness_history: string | null;
  past_medical_history: string | null;
  past_surgical_history: string | null;
  allergies_text: string | null;
  medications_current: string | null;
  family_hx: string | null;
  smoking_hx: string | null;
  alcohol_hx: string | null;
  last_updated: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const EDITABLE_FIELDS: (keyof Patient)[] = [
  // keep keys NOT editable: patient_id, full_name, birthday
  "sex",
  "contact",
  "address",
  "email",
  "chief_complaint",
  "present_illness_history",
  "past_medical_history",
  "past_surgical_history",
  "allergies_text",
  "medications_current",
  "family_hx",
  "smoking_hx",
  "alcohol_hx",
];

const READONLY_FIELDS: (keyof Patient)[] = [
  "patient_id",
  "full_name",
  "birthday",
  "age",
  "height_ft",
  "height_inch",
  "weight_kg",
  "systolic_bp",
  "diastolic_bp",
  "last_updated",
  "created_at",
  "updated_at",
];

const LABELS: Record<keyof Patient, string> = {
  patient_id: "Patient ID",
  full_name: "Full Name (locked)",
  age: "Age",
  sex: "Sex",
  birthday: "Birthday (locked)",
  contact: "Contact No.",
  address: "Address",
  email: "Email",
  height_ft: "Height (feet)",
  height_inch: "Height (inches)",
  weight_kg: "Weight (kg)",
  systolic_bp: "BP Systolic",
  diastolic_bp: "BP Diastolic",
  chief_complaint: "Chief Complaint",
  present_illness_history: "History of Present Illness",
  past_medical_history: "Past Medical History",
  past_surgical_history: "Past Surgical History",
  allergies_text: "Allergies",
  medications_current: "Current Medications",
  family_hx: "Family History",
  smoking_hx: "Smoking History",
  alcohol_hx: "Alcohol History",
  last_updated: "Last Updated",
  created_at: "Created At",
  updated_at: "Updated At",
};

const HELP: Partial<Record<keyof Patient, string>> = {
  chief_complaint: "Ano pong pinaka-iniinda ngayon? (hal. sakit ng ulo, ubo, lagnat)",
  present_illness_history: "Kailan nagsimula? Gaano kadalas? May nagpapalala o nagpapagaan?",
  past_medical_history: "Mga dating sakit? (hal. hika, alta presyon, diabetes)",
  past_surgical_history: "May naoperahan na ba dati? Kailan at bakit?",
  allergies_text: "Allergy sa gamot/ pagkain/ iba? Anong reaksyon?",
  medications_current: "Anong gamot ang iniinom ngayon? Dose at gaano kadalas?",
  family_hx: "May lahi ba sa pamilya? (hal. Diabetes, Hypertension, cancer)",
  smoking_hx: "Naninigarilyo ba? Ilang stick per day at gaano katagal?",
  alcohol_hx: "Umiinom ba ng alak? Gaano kadalas at gaano karami?",
  contact: "Active na number na matatawagan",
  address: "Brgy., City",
  email: "Kung mayroong aktibo na email",
};

const NUMERIC_FIELDS = new Set<keyof Patient>([
  "age",
  "height_ft",
  "height_inch",
  "weight_kg",
  "systolic_bp",
  "diastolic_bp",
]);

function coerce(value: any, field: keyof Patient) {
  if (value === "" || value === null || value === undefined) return null;
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return String(value);
}

type Branch = "SI" | "SL";

function nowLocalInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PatientHistoryPage() {
  const [searchId, setSearchId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [found, setFound] = React.useState(false);

  const [initial, setInitial] = React.useState<Patient | null>(null);
  const [form, setForm] = React.useState<Partial<Patient>>({});

  // New state for create panel
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newSurname, setNewSurname] = React.useState("");
  const [newFirstname, setNewFirstname] = React.useState("");
  const [newBirthday, setNewBirthday] = React.useState(""); // "YYYY-MM-DD"

  const [branchFilter, setBranchFilter] = React.useState<Branch>(() => resolveScopedBranch());
  const [todayPatients, setTodayPatients] = React.useState<
    Array<{
      encounter_id: string;
      patient_id: string;
      full_name: string | null;
      queue_number: number | null;
      status: string | null;
      consult_status: string | null;
    }>
  >([]);
  const [todayLoading, setTodayLoading] = React.useState(false);
  const [todayError, setTodayError] = React.useState<string | null>(null);

  const [vitals, setVitals] = React.useState<VitalsSnapshot[]>([]);
  const [vitalsLoading, setVitalsLoading] = React.useState(false);
  const [vitalsError, setVitalsError] = React.useState<string | null>(null);
  const [vitalsSubmitError, setVitalsSubmitError] = React.useState<string | null>(null);
  const [vitalsSaving, setVitalsSaving] = React.useState(false);
  const [encounters, setEncounters] = React.useState<
    Array<{
      id: string;
      visit_date_local: string | null;
      branch_code: string | null;
      status: string | null;
      queue_number: number | null;
    }>
  >([]);
  const [vitalsForm, setVitalsForm] = React.useState({
    encounter_id: "",
    measured_at: nowLocalInput(),
    height_ft: "",
    height_inch: "",
    weight_kg: "",
    systolic_bp: "",
    diastolic_bp: "",
    hr: "",
    rr: "",
    temp_c: "",
    o2sat: "",
    notes: "",
  });

  function asciiUpperNoSpaces(s: string) {
    return s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9]/g, "") // remove spaces, hyphens, apostrophes
      .toUpperCase();
  }

  function mmddyy(dateStr: string) {
    // dateStr: "YYYY-MM-DD"
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const [, yyyy, mm, dd] = m;
    return `${mm}${dd}${yyyy.slice(-2)}`;
  }

  function mmddyyyy(dateStr: string) {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const [, yyyy, mm, dd] = m;
    return `${mm}/${dd}/${yyyy}`; // matches your existing data
  }

  const resetVitalsForm = React.useCallback(() => {
    setVitalsForm((prev) => ({
      encounter_id: prev.encounter_id || "",
      measured_at: nowLocalInput(),
      height_ft: "",
      height_inch: "",
      weight_kg: "",
      systolic_bp: "",
      diastolic_bp: "",
      hr: "",
      rr: "",
      temp_c: "",
      o2sat: "",
      notes: "",
    }));
    setVitalsSubmitError(null);
  }, []);

  const loadVitals = React.useCallback(async (pid: string) => {
    if (!pid) return;
    setVitalsLoading(true);
    setVitalsError(null);
    try {
      const res = await fetch(`/api/staff/vitals?patient_id=${encodeURIComponent(pid)}&limit=8`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to fetch vitals");
      setVitals(json.snapshots || []);
    } catch (e: any) {
      setVitalsError(e?.message || "Failed to fetch vitals");
      setVitals([]);
    } finally {
      setVitalsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (encounters.length === 0) return;
    setVitalsForm((prev) => {
      if (prev.encounter_id) return prev;
      return { ...prev, encounter_id: encounters[0].id };
    });
  }, [encounters]);

  const loadEncounters = React.useCallback(async (pid: string) => {
    if (!pid) return;
    try {
      const res = await fetch(
        `/api/staff/patients/encounters?patient_id=${encodeURIComponent(pid)}&limit=12`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to load encounters");
      setEncounters((json.rows || []) as any);
    } catch {
      setEncounters([]);
    }
  }, []);

  const loadTodayPatients = React.useCallback(async (branch: Branch) => {
    setTodayLoading(true);
    setTodayError(null);
    try {
      const params = new URLSearchParams();
      params.set("view", "quick");
      params.set("branch", branch);
      const res = await fetch(`/api/staff/encounters/today?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to load today's patients");
      setTodayPatients(json.rows || []);
    } catch (e: any) {
      setTodayError(e?.message || "Failed to load today's patients");
      setTodayPatients([]);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTodayPatients(branchFilter);
  }, [branchFilter, loadTodayPatients]);

  function heightToCm(ftStr: string, inStr: string) {
    const ft = Number(ftStr) || 0;
    const inch = Number(inStr) || 0;
    if (!ft && !inch) return null;
    const cm = (ft * 12 + inch) * 2.54;
    return Math.round(cm * 100) / 100;
  }

  function formatDateTimePH(value?: string | null) {
    if (!value) return "—";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  }

  function formatHeightFromCm(cm?: number | null) {
    if (cm == null) return "—";
    const num = Number(cm);
    if (!Number.isFinite(num)) return "—";
    const totalIn = num / 2.54;
    const ft = Math.floor(totalIn / 12);
    const inch = Math.round(totalIn - ft * 12);
    return `${ft}ft ${inch}in`;
  }

  function describeEncounter(enc: {
    visit_date_local: string | null;
    branch_code: string | null;
    status: string | null;
    queue_number: number | null;
  }) {
    const date = enc.visit_date_local
      ? new Date(enc.visit_date_local).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })
      : "No date";
    const branch = enc.branch_code || "—";
    const status = enc.status || "pending";
    const queue = enc.queue_number ? ` · Queue #${enc.queue_number}` : "";
    return `${date} · ${branch} · ${status}${queue}`;
  }

  function toIsoString(local: string) {
    if (!local) return new Date().toISOString();
    const dt = new Date(local);
    if (Number.isNaN(dt.getTime())) return new Date().toISOString();
    return dt.toISOString();
  }

  const onSaveVitals = async () => {
    if (!initial) return;
    if (!vitalsForm.encounter_id) {
      setVitalsSubmitError("Select an encounter before saving.");
      return;
    }
    setVitalsSaving(true);
    setVitalsSubmitError(null);
    try {
      const payload: Record<string, any> = {
        patient_id: initial.patient_id,
        encounter_id: vitalsForm.encounter_id,
        measured_at: toIsoString(vitalsForm.measured_at),
        notes: vitalsForm.notes?.trim() || null,
      };

      (
        ["systolic_bp", "diastolic_bp", "hr", "rr", "temp_c", "o2sat", "weight_kg"] as const
      ).forEach((key) => {
        const raw = vitalsForm[key as keyof typeof vitalsForm];
        payload[key] = raw ? Number(raw) : null;
      });

      const heightCm = heightToCm(vitalsForm.height_ft, vitalsForm.height_inch);
      if (heightCm != null) payload.height_cm = heightCm;

      const res = await fetch("/api/staff/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to save vitals");
      resetVitalsForm();
      await loadVitals(initial.patient_id);
    } catch (e: any) {
      setVitalsSubmitError(e?.message || "Failed to save vitals");
    } finally {
      setVitalsSaving(false);
    }
  };

  const onRetrieve = async (idOverride?: string) => {
    setError(null);
    setFound(false);
    setInitial(null);
    setForm({});
    setVitals([]);
    setEncounters([]);
    resetVitalsForm();

    const target = (idOverride ?? searchId).trim();
    if (!target) {
      setError("Please enter a Patient ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/staff/patients/details?patient_id=${encodeURIComponent(target)}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Patient ID not found.");
      }
      if (!json.patient) {
        throw new Error("Patient ID not found.");
      }

      setFound(true);
      setInitial(json.patient as Patient);

      const copy: Partial<Patient> = {};
      for (const k of [...EDITABLE_FIELDS, ...READONLY_FIELDS]) {
        copy[k] = (json.patient as any)[k] ?? null;
      }
      setForm(copy);
    } catch (e: any) {
      setError(e?.message || "Patient ID not found.");
    } finally {
      setLoading(false);
    }
  };

  const onVitalsChange = (field: keyof typeof vitalsForm, value: string) => {
    setVitalsSubmitError(null);
    setVitalsForm((prev) => ({ ...prev, [field]: value }));
  };
  React.useEffect(() => {
    if (initial?.patient_id) {
      loadVitals(initial.patient_id);
      loadEncounters(initial.patient_id);
      resetVitalsForm();
    }
  }, [initial?.patient_id, loadVitals, loadEncounters, resetVitalsForm]);

  const onPickPatient = async (patientId: string) => {
    setSearchId(patientId.toUpperCase());
    await onRetrieve(patientId);
  };

  const onChange = (field: keyof Patient, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const computeUpdates = (): Partial<Patient> => {
    if (!initial) return {};
    const updates: Partial<Patient> = {};

    for (const field of EDITABLE_FIELDS) {
      const before = (initial as any)[field];
      const afterRaw = (form as any)[field];

      // Skip if staff left it blank → do not touch DB for this field.
      if (afterRaw === "" || afterRaw === null || afterRaw === undefined) continue;

      const after = coerce(afterRaw, field);

      // Only send if changed
      const changed =
        (NUMERIC_FIELDS.has(field) ? Number(before ?? null) : String(before ?? "")) !==
        (NUMERIC_FIELDS.has(field) ? Number(after ?? null) : String(after ?? ""));

      if (changed) {
        (updates as any)[field] = after;
      }
    }

    // Always let DB stamp last_updated via trigger (recommended).
    // If you haven’t added the trigger yet, uncomment the next line to stamp from client:
    // (updates as any)["last_updated"] = new Date().toISOString();

    return updates;
  };

  const onUpdate = async () => {
    setError(null);
    if (!initial) return;
    const updates = computeUpdates();

    if (Object.keys(updates).length === 0) {
      setError("No changes to save (blank fields are ignored).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/staff/patients/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: initial.patient_id, ...updates }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to update patient.");
      }

      if (json.patient) {
        setInitial(json.patient as Patient);
        const copy: Partial<Patient> = {};
        for (const k of [...EDITABLE_FIELDS, ...READONLY_FIELDS]) {
          copy[k] = (json.patient as any)[k] ?? null;
        }
        setForm(copy);
        alert("Patient updated successfully.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to update patient.");
    } finally {
      setSaving(false);
    }
  };

  const viewerHref = initial ? `/staff/portal` : "#";
  // '/patient-results?patient_id=${encodeURIComponent(initial.patient_id)}` : "#";
  const rxHref = initial ? `/staff/prescriptions` : "#";
  // /prescriptions?patient_id=${encodeURIComponent(initial.patient_id)}` : "#";
  const otherLabs = initial ? `/staff/other-labs` : "#";

  const latestVitals = vitals[0] ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Staff · Patient History / Editor</h1>

      {/* Create New Patient (collapsible) */}
      <div className="rounded-2xl border p-4 space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setShowCreate((s) => !s)}
        >
          <span className="text-sm font-medium">Create New Patient</span>
          <span className="text-xl">{showCreate ? "▾" : "▸"}</span>
        </button>

        {showCreate && (
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Surname</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                value={newSurname}
                onChange={(e) => setNewSurname(e.target.value)}
                placeholder="Apelyido"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">First name</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                value={newFirstname}
                onChange={(e) => setNewFirstname(e.target.value)}
                placeholder="Pangalan"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">Birthday</label>
              <input
                type="date"
                className="w-full rounded-xl border px-3 py-2"
                value={newBirthday}
                onChange={(e) => setNewBirthday(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <button
                className={BTN}
                disabled={creating || !newSurname.trim() || !newFirstname.trim() || !newBirthday}
                onClick={async () => {
                  setError(null);
                  setCreating(true);
                  try {
                    const SUR = asciiUpperNoSpaces(newSurname);
                    const FST = asciiUpperNoSpaces(newFirstname);
                    const bdayISO = newBirthday; // "YYYY-MM-DD" from <input type="date">

                    if (!SUR || !FST || !bdayISO)
                      throw new Error("Please complete Surname, First name, and Birthday.");

                    // 1) Check for an existing person (exact name + birthday)
                    const fullName = `${SUR}, ${FST}`;
                    {
                      const dupRes = await fetch(
                        `/api/staff/patients/check-duplicate?full_name=${encodeURIComponent(
                          fullName,
                        )}&birthday=${encodeURIComponent(bdayISO)}`,
                        { cache: "no-store" },
                      );
                      const dupJson = await dupRes.json();
                      if (!dupRes.ok && dupJson?.error) {
                        throw new Error(dupJson.error || "Failed to check duplicates");
                      }

                      if (dupJson?.match?.patient_id) {
                        const existingId = dupJson.match.patient_id;
                        const open = window.confirm(
                          `Mukhang existing na ang pasyente na ito (ID: ${existingId}).\n\n` +
                            `Open existing record instead? (OK = Open, Cancel = Create new anyway)`,
                        );
                        if (open) {
                          setSearchId(existingId);
                          setShowCreate(false);
                          setNewSurname("");
                          setNewFirstname("");
                          setNewBirthday("");
                          // load the form for existing ID (reuse your loader)
                          await onRetrieve(existingId);
                          return;
                        }
                        // else: continue to create anyway (go to suffix flow)
                      }
                    }

                    // 2) Build base patient_id and resolve collisions
                    const code = mmddyy(bdayISO);
                    let candidate = `${SUR}${code}`;
                    let suffix = 0;

                    async function idExists(id: string) {
                      const res = await fetch(
                        `/api/staff/patients/id-exists?patient_id=${encodeURIComponent(id)}`,
                        { cache: "no-store" },
                      );
                      const json = await res.json();
                      if (!res.ok || json?.error) {
                        throw new Error(json?.error || "Failed to check patient ID");
                      }
                      return !!json.exists;
                    }

                    if (await idExists(candidate)) {
                      // First collision: ask user before we suffix
                      const ok = window.confirm(
                        `Patient ID ${candidate} is already taken.\n\n` +
                          `We will create a new ID with a suffix (e.g., ${candidate}-1).\n` +
                          `Proceed?`,
                      );
                      if (!ok) {
                        setCreating(false);
                        return;
                      }
                      while (await idExists(candidate)) {
                        suffix += 1;
                        candidate = `${SUR}${code}-${suffix}`;
                      }
                    }

                    // 3) Insert minimal row (birthday as DATE ISO)
                    const createRes = await fetch("/api/staff/patients/create", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        patient_id: candidate,
                        full_name: fullName,
                        birthday: bdayISO,
                      }),
                    });
                    const createJson = await createRes.json();
                    if (!createRes.ok || createJson?.error) {
                      throw new Error(createJson?.error || "Failed to create patient");
                    }

                    // 4) Load the editor for the new patient
                    setSearchId(candidate);
                    setShowCreate(false);
                    setNewSurname("");
                    setNewFirstname("");
                    setNewBirthday("");

                    setInitial(createJson.patient as Patient);
                    const copy: Partial<Patient> = {};
                    for (const k of [...EDITABLE_FIELDS, ...READONLY_FIELDS]) {
                      copy[k] = (createJson.patient as any)[k] ?? null;
                    }
                    setForm(copy);

                    alert(`Created: ${candidate}`);
                  } catch (e: any) {
                    setError(e?.message || String(e));
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating ? "Creating…" : "Create & Open"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Today's queue */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Today’s Patients</h2>
            <p className="text-xs text-neutral-500">
              Filter by branch, then tap a patient to load their chart.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border px-3 py-2 text-sm"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value as Branch)}
            >
              <option value="SI">San Isidro (SI)</option>
              <option value="SL">San Leonardo (SL)</option>
            </select>
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm text-[#44969b]"
              onClick={() => loadTodayPatients(branchFilter)}
              disabled={todayLoading}
            >
              {todayLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {todayError && <p className="text-sm text-red-600">{todayError}</p>}

        <div className="flex gap-3 overflow-x-auto pb-1">
          {todayPatients.length === 0 && !todayLoading ? (
            <div className="text-sm text-neutral-500">
              No patients queued today for this branch.
            </div>
          ) : (
            todayPatients.map((pat) => (
              <button
                key={pat.encounter_id}
                type="button"
                onClick={() => onPickPatient(pat.patient_id)}
                className="min-w-[220px] flex-1 rounded-2xl border px-4 py-3 text-left shadow-sm bg-white"
              >
                <div className="text-xs uppercase text-neutral-500 flex items-center gap-2">
                  <span className="font-semibold text-[#44969b]">#{pat.queue_number ?? "—"}</span>
                  <span>{pat.status || "intake"}</span>
                </div>
                <div className="font-semibold text-sm truncate">
                  {pat.full_name || pat.patient_id}
                </div>
                <div className="text-xs text-neutral-500">{pat.patient_id}</div>
                {pat.consult_status && (
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-neutral-600">
                    Consult: {pat.consult_status}
                  </div>
                )}
                <div className="mt-2 text-center text-xs text-[#44969b] font-medium">
                  Tap to open
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Search */}
      <div className="rounded-2xl border p-4 space-y-3">
        <label className="block text-sm font-medium">Enter Patient ID</label>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onRetrieve();
          }}
        >
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="e.g., SATOH010596"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value.toUpperCase())} // normalize
          />
          <button
            type="submit"
            disabled={loading || !searchId.trim()}
            className={[BTN, "w-full sm:w-auto"].join(" ")}
          >
            {loading ? "Searching…" : "Retrieve Data"}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {found && !error && (
          <p className="text-green-700 text-sm">Patient found. Data loaded below.</p>
        )}
      </div>

      {/* Quick links */}
      {initial && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-600">Quick open:</span>
          <a className="underline text-sm" href={viewerHref} target="_blank">
            Results Viewer
          </a>
          <a className="underline text-sm" href={rxHref} target="_blank">
            Prescriptions
          </a>
          <a className="underline text-sm" href={otherLabs} target="_blank">
            Other Labs/Sendouts
          </a>
          <span className="text-xs text-neutral-500">
            (You can wire these to your actual routes later.)
          </span>
        </div>
      )}

      {initial && (
        <section className="rounded-2xl border p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Vitals Snapshots</h2>
              <p className="text-xs text-neutral-500">
                Linked to consultation + encounter for future XML exports.
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-[#44969b]"
              onClick={() => loadVitals(initial.patient_id)}
              disabled={vitalsLoading}
            >
              {vitalsLoading ? "Refreshing…" : "Refresh list"}
            </button>
          </div>

          {vitalsError && <p className="text-sm text-red-600">{vitalsError}</p>}

          {latestVitals ? (
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-neutral-500">Measured at</div>
                <div className="font-medium">{formatDateTimePH(latestVitals.measured_at)}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Blood Pressure</div>
                <div className="font-medium">
                  {latestVitals.systolic_bp && latestVitals.diastolic_bp
                    ? `${latestVitals.systolic_bp}/${latestVitals.diastolic_bp} mmHg`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Weight</div>
                <div className="font-medium">
                  {latestVitals.weight_kg ? `${latestVitals.weight_kg} kg` : form.weight_kg || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Height</div>
                <div className="font-medium">{formatHeightFromCm(latestVitals.height_cm)}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Vitals</div>
                <div className="font-medium space-x-2">
                  {latestVitals.hr && <span>HR {latestVitals.hr} bpm</span>}
                  {latestVitals.rr && <span>RR {latestVitals.rr}/min</span>}
                  {latestVitals.temp_c && <span>Temp {latestVitals.temp_c} °C</span>}
                  {latestVitals.o2sat && <span>O₂ {latestVitals.o2sat}%</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Recorded by</div>
                <div className="font-medium">{latestVitals.created_by_initials || "—"}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No vitals recorded yet for this patient.</p>
          )}

          {vitals.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-2 pr-4">Measured</th>
                    <th className="py-2 pr-4">BP</th>
                    <th className="py-2 pr-4">HR/RR</th>
                    <th className="py-2 pr-4">Temp</th>
                    <th className="py-2 pr-4">Weight</th>
                    <th className="py-2 pr-4">Notes</th>
                    <th className="py-2 pr-4">Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((snap) => (
                    <tr key={snap.id} className="border-t">
                      <td className="py-2 pr-4">{formatDateTimePH(snap.measured_at)}</td>
                      <td className="py-2 pr-4">
                        {snap.systolic_bp && snap.diastolic_bp
                          ? `${snap.systolic_bp}/${snap.diastolic_bp} mmHg`
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {snap.hr ? `HR ${snap.hr} bpm` : ""} {snap.rr ? `RR ${snap.rr}/min` : ""}
                      </td>
                      <td className="py-2 pr-4">
                        {snap.temp_c ? `${snap.temp_c} °C` : "—"}{" "}
                        {snap.o2sat ? `· O₂ ${snap.o2sat}%` : ""}
                      </td>
                      <td className="py-2 pr-4">{snap.weight_kg ? `${snap.weight_kg} kg` : "—"}</td>
                      <td className="py-2 pr-4">{snap.notes || "—"}</td>
                      <td className="py-2 pr-4">
                        {snap.created_by_initials || snap.source || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <h3 className="text-md font-semibold">Record New Vitals</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium">Encounter</label>
                <select
                  className="w-full rounded-xl border px-3 py-2"
                  value={vitalsForm.encounter_id}
                  onChange={(e) => onVitalsChange("encounter_id", e.target.value)}
                >
                  <option value="">Select recent encounter…</option>
                  {encounters.map((enc) => (
                    <option key={enc.id} value={enc.id}>
                      {describeEncounter(enc)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500">
                  Defaults to the latest encounter checked-in at reception.
                </p>
                {encounters.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No encounters found. Ask reception to create one before recording vitals.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Encounter ID</label>
                <div className="rounded-xl border px-3 py-2 font-mono text-xs bg-neutral-50 break-all">
                  {vitalsForm.encounter_id || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Measured at</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border px-3 py-2"
                  value={vitalsForm.measured_at}
                  onChange={(e) => onVitalsChange("measured_at", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Height (ft / in)</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="ft"
                    value={vitalsForm.height_ft}
                    onChange={(e) => onVitalsChange("height_ft", e.target.value)}
                  />
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="in"
                    value={vitalsForm.height_inch}
                    onChange={(e) => onVitalsChange("height_inch", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Weight (kg)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={vitalsForm.weight_kg}
                  onChange={(e) => onVitalsChange("weight_kg", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Blood Pressure</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="Sys"
                    value={vitalsForm.systolic_bp}
                    onChange={(e) => onVitalsChange("systolic_bp", e.target.value)}
                  />
                  <span className="text-center text-sm text-neutral-500 sm:w-auto">/</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="Dia"
                    value={vitalsForm.diastolic_bp}
                    onChange={(e) => onVitalsChange("diastolic_bp", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Heart Rate (bpm)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={vitalsForm.hr}
                  onChange={(e) => onVitalsChange("hr", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Respiratory Rate (/min)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={vitalsForm.rr}
                  onChange={(e) => onVitalsChange("rr", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">Temperature (°C)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={vitalsForm.temp_c}
                  onChange={(e) => onVitalsChange("temp_c", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">O₂ Saturation (%)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={vitalsForm.o2sat}
                  onChange={(e) => onVitalsChange("o2sat", e.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <label className="block text-sm font-medium">Notes</label>
                <textarea
                  className="w-full rounded-xl border px-3 py-2"
                  rows={2}
                  value={vitalsForm.notes}
                  onChange={(e) => onVitalsChange("notes", e.target.value)}
                />
              </div>
            </div>
            {vitalsSubmitError && <p className="text-sm text-red-600">{vitalsSubmitError}</p>}
            <button type="button" className={BTN} onClick={onSaveVitals} disabled={vitalsSaving}>
              {vitalsSaving ? "Saving vitals…" : "Save Vitals"}
            </button>
          </div>
        </section>
      )}

      {/* Form */}
      {initial && (
        <div className="rounded-2xl border p-4 space-y-6">
          {/* Identity (locked fields at top) */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Identity</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {(["patient_id", "full_name", "birthday"] as (keyof Patient)[]).map((f) => (
                <div key={f} className="space-y-1">
                  <label className="block text-sm font-medium">{LABELS[f]}</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 bg-neutral-100"
                    value={(form[f] ?? "") as string}
                    onChange={(e) => onChange(f, e.target.value)}
                    readOnly
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.age}</label>
                <input
                  className="w-full rounded-xl border px-3 py-2 bg-neutral-100"
                  value={(form.age ?? "") as any}
                  readOnly
                />
                <p className="text-xs text-neutral-500">Auto-computed from Birthday.</p>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.sex}</label>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="M / F"
                  value={(form.sex ?? "") as any}
                  onChange={(e) => onChange("sex", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.contact}</label>
                {HELP.contact && <p className="text-xs text-neutral-500">{HELP.contact}</p>}
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={(form.contact ?? "") as any}
                  onChange={(e) => onChange("contact", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.email}</label>
                {HELP.email && <p className="text-xs text-neutral-500">{HELP.email}</p>}
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={(form.email ?? "") as any}
                  onChange={(e) => onChange("email", e.target.value)}
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="block text-sm font-medium">{LABELS.address}</label>
                {HELP.address && <p className="text-xs text-neutral-500">{HELP.address}</p>}
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={(form.address ?? "") as any}
                  onChange={(e) => onChange("address", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Medical Histories */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Medical Interview</h2>
            <div className="grid gap-3">
              {(
                [
                  "chief_complaint",
                  "present_illness_history",
                  "past_medical_history",
                  "past_surgical_history",
                  "allergies_text",
                  "medications_current",
                  "family_hx",
                  "smoking_hx",
                  "alcohol_hx",
                ] as (keyof Patient)[]
              ).map((f) => (
                <div key={f} className="space-y-1">
                  <label className="block text-sm font-medium">{LABELS[f]}</label>
                  {HELP[f] && <p className="text-xs text-neutral-500">{HELP[f]}</p>}
                  <textarea
                    rows={f === "chief_complaint" ? 2 : 3}
                    className="w-full rounded-xl border px-3 py-2"
                    value={(form[f] ?? "") as any}
                    onChange={(e) => onChange(f, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Timestamps */}
          <section className="grid md:grid-cols-3 gap-3">
            {(["last_updated", "created_at", "updated_at"] as (keyof Patient)[]).map((f) => (
              <div key={f} className="space-y-1">
                <label className="block text-sm font-medium">{LABELS[f]}</label>
                <input
                  className="w-full rounded-xl border px-3 py-2 bg-neutral-100"
                  value={toPH((form[f] ?? "") as string)}
                  readOnly
                />
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={onUpdate}
              disabled={saving}
              className={[BTN, "w-full sm:w-auto"].join(" ")}
            >
              {saving ? "Updating…" : "Update"}
            </button>
            <span className="text-center text-xs text-neutral-500 sm:text-left">
              Only changed (and non-blank) fields are saved. Keys are locked.
            </span>
          </div>
        </div>
      )}

      {!initial && (
        <div className="text-sm text-neutral-500">
          Tip: Find a patient first. The form will show current data (even blanks) and you can type
          as you interview.
        </div>
      )}
    </div>
  );
}

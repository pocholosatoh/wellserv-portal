"use client";
import React from "react";

// OLD (problematic: pointed to mixed server/client file)
// import { getSupabaseBrowser } from "@/lib/supabase";

// NEW (safe)
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import StaffNavi from "@/app/staff/_components/StaffNavi";

const BTN =
  "rounded-xl bg-[#44969b] text-white px-4 py-2 font-medium shadow-card transition-all " +
  "hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#44969b] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const supabase = getSupabaseBrowser();

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
  "height_ft",
  "height_inch",
  "weight_kg",
  "systolic_bp",
  "diastolic_bp",
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

const READONLY_FIELDS: (keyof Patient)[] = ["patient_id", "full_name", "birthday", "age", "last_updated", "created_at", "updated_at"];

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

  const onRetrieve = async (idOverride?: string) => {
    setError(null);
    setFound(false);
    setInitial(null);
    setForm({});

    const target = (idOverride ?? searchId).trim();
    if (!target) {
      setError("Please enter a Patient ID.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("patient_id", target)   // exact match (we already uppercase the input)
      .single();
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (!data) {
      setError("Patient ID not found.");
      return;
    }

    setFound(true);
    setInitial(data as Patient);

    const copy: Partial<Patient> = {};
    for (const k of [...EDITABLE_FIELDS, ...READONLY_FIELDS]) {
      copy[k] = (data as any)[k] ?? null;
    }
    setForm(copy);
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
    const { data, error } = await supabase
      .from("patients")
      .update(updates)
      .eq("patient_id", initial.patient_id)
      .select("*");

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data && data[0]) {
      setInitial(data[0] as Patient);
      // Refresh the form with saved values
      const copy: Partial<Patient> = {};
      for (const k of [...EDITABLE_FIELDS, ...READONLY_FIELDS]) {
        copy[k] = (data[0] as any)[k] ?? null;
      }
      setForm(copy);
      alert("Patient updated successfully.");
    }
  };

  const viewerHref = initial ? `/staff/portal` : "#";
  // '/patient-results?patient_id=${encodeURIComponent(initial.patient_id)}` : "#";
  const rxHref = initial ? `/staff/prescriptions` : "#";
  // /prescriptions?patient_id=${encodeURIComponent(initial.patient_id)}` : "#";
  const otherLabs = initial ? `/staff/other-labs` : "#";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Staff · Patient History / Editor</h1>

      {/* Create New Patient (collapsible) */}
      <div className="rounded-2xl border p-4 space-y-3">
        <button
          type="button"
          className="flex items-center justify-between w-full"
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

                    if (!SUR || !FST || !bdayISO) throw new Error("Please complete Surname, First name, and Birthday.");

                    // 1) Check for an existing person (exact name + birthday)
                    const fullName = `${SUR}, ${FST}`;
                    {
                      const { data: dupRows, error: dupErr } = await supabase
                        .from("patients")
                        .select("patient_id, full_name, birthday")
                        .eq("full_name", fullName)
                        .eq("birthday", bdayISO)
                        .limit(1);
                      if (dupErr) throw dupErr;

                      if (dupRows && dupRows.length > 0) {
                        const existingId = dupRows[0].patient_id;
                        const open = window.confirm(
                          `Mukhang existing na ang pasyente na ito (ID: ${existingId}).\n\n` +
                          `Open existing record instead? (OK = Open, Cancel = Create new anyway)`
                        );
                        if (open) {
                          setSearchId(existingId);
                          setShowCreate(false);
                          setNewSurname(""); setNewFirstname(""); setNewBirthday("");
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
                      const { count, error } = await supabase
                        .from("patients")
                        .select("patient_id", { count: "exact", head: true })
                        .eq("patient_id", id);
                      if (error) throw error;
                      return (count ?? 0) > 0;
                    }

                    if (await idExists(candidate)) {
                      // First collision: ask user before we suffix
                      const ok = window.confirm(
                        `Patient ID ${candidate} is already taken.\n\n` +
                        `We will create a new ID with a suffix (e.g., ${candidate}-1).\n` +
                        `Proceed?`
                      );
                      if (!ok) { setCreating(false); return; }
                      while (await idExists(candidate)) {
                        suffix += 1;
                        candidate = `${SUR}${code}-${suffix}`;
                      }
                    }

                    // 3) Insert minimal row (birthday as DATE ISO)
                    const { data: ins, error: insErr } = await supabase
                      .from("patients")
                      .insert({
                        patient_id: candidate,
                        full_name: fullName,
                        birthday: bdayISO,  // DATE column expects YYYY-MM-DD
                      })
                      .select("*")
                      .single();
                    if (insErr) throw insErr;

                    // 4) Load the editor for the new patient
                    setSearchId(candidate);
                    setShowCreate(false);
                    setNewSurname(""); setNewFirstname(""); setNewBirthday("");

                    setInitial(ins as Patient);
                    const copy: Partial<Patient> = {};
                    for (const k of [...EDITABLE_FIELDS, ...READONLY_FIELDS]) {
                      copy[k] = (ins as any)[k] ?? null;
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

      {/* Search */}
      <div className="rounded-2xl border p-4 space-y-3">
        <label className="block text-sm font-medium">Enter Patient ID</label>

        <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); onRetrieve(); }}
        >
            <input
            className="flex-1 rounded-xl border px-3 py-2"
            placeholder="e.g., SATOH010596"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value.toUpperCase())}  // normalize
            />
            <button type="submit" disabled={loading || !searchId.trim()} className={BTN}>
            {loading ? "Searching…" : "Retrieve Data"}
            </button>
        </form>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {found && !error && <p className="text-green-700 text-sm">Patient found. Data loaded below.</p>}
        </div>

      {/* Quick links */}
      {initial && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-600">Quick open:</span>
          <a className="underline text-sm" href={viewerHref} target="_blank">Results Viewer</a>
          <a className="underline text-sm" href={rxHref} target="_blank">Prescriptions</a>
          <a className="underline text-sm" href={otherLabs} target="_blank">Other Labs/Sendouts</a>
          <span className="text-xs text-neutral-500">(You can wire these to your actual routes later.)</span>
        </div>
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

          {/* Vitals */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Vitals</h2>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.height_ft}</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={(form.height_ft ?? "") as any}
                  onChange={(e) => onChange("height_ft", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.height_inch}</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={(form.height_inch ?? "") as any}
                  onChange={(e) => onChange("height_inch", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.weight_kg}</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-xl border px-3 py-2"
                  value={(form.weight_kg ?? "") as any}
                  onChange={(e) => onChange("weight_kg", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.systolic_bp}</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={(form.systolic_bp ?? "") as any}
                  onChange={(e) => onChange("systolic_bp", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{LABELS.diastolic_bp}</label>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2"
                  value={(form.diastolic_bp ?? "") as any}
                  onChange={(e) => onChange("diastolic_bp", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Medical Histories */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Medical Interview</h2>
            <div className="grid gap-3">
              {([
                "chief_complaint",
                "present_illness_history",
                "past_medical_history",
                "past_surgical_history",
                "allergies_text",
                "medications_current",
                "family_hx",
                "smoking_hx",
                "alcohol_hx",
              ] as (keyof Patient)[]).map((f) => (
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

          <div className="flex items-center gap-2">
            <button
              onClick={onUpdate}
              disabled={saving}
              className={BTN}
            >
              {saving ? "Updating…" : "Update"}
            </button>
            <span className="text-xs text-neutral-500">
              Only changed (and non-blank) fields are saved. Keys are locked.
            </span>
          </div>
        </div>
      )}

      {!initial && (
        <div className="text-sm text-neutral-500">
          Tip: Find a patient first. The form will show current data (even blanks) and you can type as you interview.
        </div>
      )}
    </div>
  );
}

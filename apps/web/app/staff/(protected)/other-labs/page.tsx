"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Upload,
  Calendar,
  Building2,
  Stethoscope,
  Image as ImageIcon,
  FileText,
  ChevronRight,
  ChevronLeft,
  XCircle,
} from "lucide-react";

const ACCENT = "#44969b";

type Category = "imaging" | "cytology" | "microbiology" | "ecg" | "in_vitro" | "other";

type PresignMeta = {
  patient_id: string;
  encounter_id: string | null;
  category: Category;
  subtype: string | null;
  taken_at: string;
  provider: string;
  impression?: string | null;
  performer_name?: string | null;
  performer_role?: string | null;
  performer_license?: string | null;
  note?: string | null;
};

type PresignItem = { uploadUrl: string; storagePath: string };
type PresignResponse = { meta: PresignMeta; items: PresignItem[] };

type Encounter = {
  id: string;
  patient_id: string;
  created_at: string;
  reason?: string | null;
  branch?: string | null;
};

type FileItem = { file: File; preview: string; contentType: string };

const yakapOptions: {
  label: string;
  value: Category;
  subtypes: { label: string; value: string }[];
  needsImpression: boolean;
}[] = [
  {
    label: "Imaging",
    value: "imaging",
    needsImpression: true,
    subtypes: [
      { label: "Chest X-Ray (PA)", value: "CXR_PA" },
      { label: "Chest X-Ray (PA + LAT)", value: "CXR_PA_LAT" },
    ],
  },
  {
    label: "Cytology",
    value: "cytology",
    needsImpression: true,
    subtypes: [
      { label: "Pap Smear (Conventional)", value: "PAP_CONVENTIONAL" },
      { label: "Pap Smear (LBC)", value: "PAP_LBC" },
    ],
  },
  {
    label: "Microbiology",
    value: "microbiology",
    needsImpression: true,
    subtypes: [{ label: "Sputum Microscopy (DSSM)", value: "SPUTUM_DSSM" }],
  },
  {
    label: "ECG",
    value: "ecg",
    needsImpression: false,
    subtypes: [{ label: "ECG — 12 lead", value: "ECG_12LEAD" }],
  },
  {
    label: "In-vitro (External)",
    value: "in_vitro",
    needsImpression: false,
    subtypes: [], // free text field instead
  },
];

function SectionCard(props: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${props.className || ""}`}>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-slate-800">
          {props.icon}
          <h2 className="text-lg font-semibold">{props.title}</h2>
        </div>
        {props.actions}
      </div>
      <div className="p-4">{props.children}</div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Patient", "Encounter", "Test", "Files", "Details", "Review"];
  return (
    <ol className="mb-4 flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium ${done ? "bg-green-50 border-green-200 text-green-700" : active ? "bg-sky-50 border-sky-200" : "bg-white border-slate-200 text-slate-500"}`}
              style={
                active
                  ? { color: ACCENT, borderColor: ACCENT + "33", backgroundColor: ACCENT + "10" }
                  : {}
              }
              title={s}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-sm ${active ? "font-semibold" : "text-slate-600"}`}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 text-slate-300">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function OtherLabsUploadPage() {
  const [step, setStep] = useState(0);

  // STEP 0 — Patient
  const [patientId, setPatientId] = useState("");
  const [patientOk, setPatientOk] = useState<boolean | null>(null);
  const [checkingPatient, setCheckingPatient] = useState(false);

  // STEP 1 — Encounter
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [loadingEnc, setLoadingEnc] = useState(false);
  const [creatingEnc, setCreatingEnc] = useState(false);

  // STEP 2 — Test selection
  const [category, setCategory] = useState<Category>("imaging");
  const [subtype, setSubtype] = useState<string | null>(null);
  const [freeSubtype, setFreeSubtype] = useState(""); // for in_vitro

  // STEP 3 — Files
  const [files, setFiles] = useState<FileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // STEP 4 — Details
  const [takenAt, setTakenAt] = useState("");
  const [provider, setProvider] = useState("");
  const [impression, setImpression] = useState("");
  const [perfName, setPerfName] = useState("");
  const [perfRole, setPerfRole] = useState("");
  const [perfLicense, setPerfLicense] = useState("");
  const [note, setNote] = useState("");

  // STEP 5 — Review
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---- Helpers
  const chosenOption = yakapOptions.find((o) => o.value === category)!;
  const requiresImpression = chosenOption.needsImpression && category !== "ecg";

  const resolvedSubtype = useMemo(() => {
    if (category === "in_vitro") {
      return freeSubtype.trim() ? freeSubtype.trim() : null;
    }
    return subtype;
  }, [category, subtype, freeSubtype]);

  function resetAfterSubmit() {
    setStep(0);
    setPatientId("");
    setPatientOk(null);
    setEncounters([]);
    setEncounterId(null);
    setCategory("imaging");
    setSubtype(null);
    setFreeSubtype("");
    setFiles([]);
    setTakenAt("");
    setProvider("");
    setImpression("");
    setPerfName("");
    setPerfRole("");
    setPerfLicense("");
    setNote("");
    setResultMsg(null);
    setErrorMsg(null);
  }

  // ---- STEP 0 actions
  async function verifyPatient() {
    setCheckingPatient(true);
    setErrorMsg(null);
    try {
      const pid = patientId.trim().toUpperCase();
      if (!pid) throw new Error("Enter a Patient ID");
      // If you have an endpoint to verify existence, call it; for now, assume exists when non-empty
      // const res = await fetch(`/api/patients/exists?patient_id=${encodeURIComponent(pid)}`);
      // const j = await res.json();
      // if (!res.ok || !j?.exists) throw new Error('Patient not found');
      setPatientId(pid);
      setPatientOk(true);
      setStep(1);
      await loadEncounters(pid);
    } catch (e: any) {
      setPatientOk(false);
      setErrorMsg(e?.message || "Patient not found");
    } finally {
      setCheckingPatient(false);
    }
  }

  // ---- STEP 1 actions
  async function loadEncounters(pid = patientId) {
    setLoadingEnc(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/encounters?patient_id=${encodeURIComponent(pid)}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load encounters");
      setEncounters(j.items || []);
      setEncounterId(j.items?.[0]?.id || null);
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not fetch encounters");
    } finally {
      setLoadingEnc(false);
    }
  }

  async function createEncounter() {
    setCreatingEnc(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/encounters/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patient_id: patientId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to create encounter");
      setEncounterId(j.id);
      await loadEncounters();
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not create encounter");
    } finally {
      setCreatingEnc(false);
    }
  }

  // ---- STEP 3 actions
  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const f = Array.from(e.target.files || []);
    const mapped = f.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      contentType: file.type || "application/octet-stream",
    }));
    setFiles((prev) => [...prev, ...mapped]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---- SUBMIT (presign → PUT → finalize)
  async function handleSubmit() {
    setSubmitting(true);
    setErrorMsg(null);
    setResultMsg(null);
    try {
      if (!patientId) throw new Error("Patient ID is required");
      if (!takenAt) throw new Error("Date taken is required");
      if (!provider) throw new Error("Provider is required");
      if (!files.length) throw new Error("Please attach at least one file");

      if (requiresImpression && !impression.trim()) {
        throw new Error("Impression is required for this test category");
      }
      if (category !== "in_vitro" && !resolvedSubtype) {
        throw new Error("Please select a subtype");
      }
      if (category === "in_vitro" && !resolvedSubtype) {
        throw new Error("Please type the test name for In-vitro");
      }

      // 1) PRESIGN
      const pres = await fetch("/api/staff/uploads/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: files.map((f) => ({ name: f.file.name, contentType: f.contentType })),
          patient_id: patientId,
          encounter_id: encounterId,
          category,
          subtype: resolvedSubtype,
          taken_at: takenAt,
          provider,
          impression: requiresImpression ? impression : undefined,
          performer_name: perfName || undefined,
          performer_role: perfRole || undefined,
          performer_license: perfLicense || undefined,
          note: note || undefined,
        }),
      });
      const pjson: PresignResponse | { error: string } = await pres.json();
      if (!pres.ok) throw new Error((pjson as any)?.error || "Presign failed");

      // 2) PUT to signed upload URLs
      await Promise.all(
        (pjson as PresignResponse).items.map((it, idx) =>
          fetch(it.uploadUrl, {
            method: "PUT",
            body: files[idx].file,
            headers: { "Content-Type": files[idx].contentType },
          }).then((r) => {
            if (!r.ok) throw new Error("Upload failed for " + files[idx].file.name);
          }),
        ),
      );

      // 3) FINALIZE
      const fin = await fetch("/api/staff/uploads/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          meta: (pjson as PresignResponse).meta,
          items: (pjson as PresignResponse).items.map((it, idx) => ({
            storagePath: it.storagePath,
            content_type: files[idx].contentType,
          })),
        }),
      });
      const fj = await fin.json();
      if (!fin.ok) throw new Error(fj?.error || "Finalize failed");

      setResultMsg("Upload saved successfully.");
      setStep(5);
    } catch (e: any) {
      setErrorMsg(e?.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- UI
  return (
    <main className="mx-auto max-w-5xl p-4">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Attach External Results</h1>
        <div className="text-sm text-slate-600">
          <span
            className="inline-block rounded-full px-3 py-1"
            style={{ backgroundColor: ACCENT + "20", color: ACCENT }}
          >
            YAKAP-ready
          </span>
        </div>
      </header>

      <Stepper step={step} />

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" /> <span>{errorMsg}</span>
          </div>
        </div>
      )}
      {resultMsg && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> <span>{resultMsg}</span>
          </div>
        </div>
      )}

      {/* STEP 0 — Patient */}
      {step === 0 && (
        <SectionCard
          title="Patient"
          icon={<Stethoscope style={{ color: ACCENT }} className="h-5 w-5" />}
          actions={null}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Enter Patient ID (e.g., SATOH010596)"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
              style={{ borderColor: ACCENT + "55" }}
            />
            <button
              onClick={verifyPatient}
              disabled={checkingPatient || !patientId.trim()}
              className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-white sm:w-auto"
              style={{ backgroundColor: ACCENT, opacity: checkingPatient ? 0.7 : 1 }}
            >
              {checkingPatient ? "Checking…" : "Verify & Continue"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </button>
          </div>
          {patientOk === false && <p className="mt-2 text-sm text-red-600">Patient not found.</p>}
        </SectionCard>
      )}

      {/* STEP 1 — Encounter */}
      {step === 1 && (
        <SectionCard
          title="Encounter"
          icon={<Calendar style={{ color: ACCENT }} className="h-5 w-5" />}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                onClick={() => setStep(step - 1)}
                className="w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
              >
                <ChevronLeft className="mr-1 inline-block h-4 w-4" />
                Back
              </button>
              <button
                onClick={() => setStep(step + 1)}
                disabled={!patientOk}
                className="w-full rounded-lg px-3 py-2 text-sm text-white sm:w-auto"
                style={{ backgroundColor: ACCENT, opacity: !patientOk ? 0.6 : 1 }}
              >
                Next
                <ChevronRight className="ml-1 inline-block h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm text-slate-600">
              Patient: <span className="font-medium">{patientId}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                onClick={() => loadEncounters()}
                className="w-full rounded-lg border px-3 py-1.5 text-sm sm:w-auto"
              >
                Refresh
              </button>
              <button
                onClick={createEncounter}
                disabled={creatingEnc}
                className="w-full rounded-lg px-3 py-1.5 text-sm text-white sm:w-auto"
                style={{ backgroundColor: ACCENT, opacity: creatingEnc ? 0.7 : 1 }}
              >
                {creatingEnc ? "Creating…" : "Create new encounter"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-3">
            {loadingEnc ? (
              <p className="text-sm text-slate-600">Loading encounters…</p>
            ) : encounters.length ? (
              <ul className="max-h-60 space-y-2 overflow-auto pr-2">
                {encounters.map((e) => (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300">
                      <input
                        type="radio"
                        name="enc"
                        checked={encounterId === e.id}
                        onChange={() => setEncounterId(e.id)}
                      />
                      <div className="flex flex-1 items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Encounter #{e.id.slice(0, 8)}</div>
                          <div className="text-xs text-slate-600">
                            {new Date(e.created_at).toLocaleString()} • {e.branch || "—"}
                            {e.reason ? ` • ${e.reason}` : ""}
                          </div>
                        </div>
                        {encounterId === e.id && (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">No encounters yet. Create a new one.</p>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Tip: Linking to the correct encounter keeps XML exports accurate.
          </p>
        </SectionCard>
      )}

      {/* STEP 2 — Test */}
      {step === 2 && (
        <SectionCard
          title="Test"
          icon={<Building2 style={{ color: ACCENT }} className="h-5 w-5" />}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                onClick={() => setStep(step - 1)}
                className="w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
              >
                <ChevronLeft className="mr-1 inline-block h-4 w-4" />
                Back
              </button>
              <button
                onClick={() => setStep(step + 1)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white sm:w-auto"
                style={{ backgroundColor: ACCENT }}
              >
                Next
                <ChevronRight className="ml-1 inline-block h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as Category);
                  setSubtype(null);
                }}
                className="w-full rounded-lg border px-3 py-2"
                style={{ borderColor: ACCENT + "55" }}
              >
                {yakapOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {category !== "in_vitro" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Subtype</label>
                <select
                  value={subtype || ""}
                  onChange={(e) => setSubtype(e.target.value || null)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Select…</option>
                  {yakapOptions
                    .find((o) => o.value === category)!
                    .subtypes.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Test name (free text)</label>
                <input
                  value={freeSubtype}
                  onChange={(e) => setFreeSubtype(e.target.value)}
                  placeholder="e.g., HBsAg (External)"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* STEP 3 — Files */}
      {step === 3 && (
        <SectionCard
          title="Files"
          icon={<Upload style={{ color: ACCENT }} className="h-5 w-5" />}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                onClick={() => setStep(step - 1)}
                className="w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
              >
                <ChevronLeft className="mr-1 inline-block h-4 w-4" />
                Back
              </button>
              <button
                onClick={() => setStep(step + 1)}
                disabled={!files.length}
                className="w-full rounded-lg px-3 py-2 text-sm text-white sm:w-auto"
                style={{ backgroundColor: ACCENT, opacity: files.length ? 1 : 0.6 }}
              >
                Next
                <ChevronRight className="ml-1 inline-block h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={onPickFiles}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm sm:w-auto"
              style={{ borderColor: ACCENT, color: ACCENT }}
            >
              <Upload className="h-4 w-4" />
              Add files
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Accepts images or PDF. You can use the camera on mobile.
            </p>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {files.map((f, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl border bg-white">
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-white/80 p-1 shadow"
                    title="Remove"
                  >
                    <XCircle className="h-5 w-5 text-red-600" />
                  </button>
                  {f.contentType.includes("pdf") ? (
                    <div className="flex h-32 items-center justify-center">
                      <FileText className="h-8 w-8 text-slate-500" />
                    </div>
                  ) : (
                    <img src={f.preview} alt={f.file.name} className="h-32 w-full object-cover" />
                  )}
                  <div className="truncate px-2 py-1 text-xs text-slate-700">{f.file.name}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* STEP 4 — Details */}
      {step === 4 && (
        <SectionCard
          title="Details"
          icon={<ImageIcon style={{ color: ACCENT }} className="h-5 w-5" />}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                onClick={() => setStep(step - 1)}
                className="w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
              >
                <ChevronLeft className="mr-1 inline-block h-4 w-4" />
                Back
              </button>
              <button
                onClick={() => setStep(step + 1)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white sm:w-auto"
                style={{ backgroundColor: ACCENT }}
              >
                Next
                <ChevronRight className="ml-1 inline-block h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date taken</label>
              <input
                type="date"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider (facility)</label>
              <input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g., Nueva Ecija Medics Hospital"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            {category !== "ecg" && chosenOption.needsImpression && (
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">
                  Impression <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={impression}
                  onChange={(e) => setImpression(e.target.value)}
                  rows={4}
                  placeholder="Final reading / impression here"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Performer name (optional)</label>
              <input
                value={perfName}
                onChange={(e) => setPerfName(e.target.value)}
                placeholder="Doctor/Radiologist name"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Performer role (optional)</label>
              <input
                value={perfRole}
                onChange={(e) => setPerfRole(e.target.value)}
                placeholder="e.g., Radiologist / Physician"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Performer license (optional)</label>
              <input
                value={perfLicense}
                onChange={(e) => setPerfLicense(e.target.value)}
                placeholder="PRC number"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Internal notes"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* STEP 5 — Review & Submit */}
      {step === 5 && (
        <SectionCard
          title="Review & Submit"
          icon={<CheckCircle2 style={{ color: ACCENT }} className="h-5 w-5" />}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                onClick={() => setStep(step - 1)}
                className="w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
              >
                <ChevronLeft className="mr-1 inline-block h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-lg px-3 py-2 text-sm text-white sm:w-auto"
                style={{ backgroundColor: ACCENT, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Uploading…" : "Submit"}
              </button>
            </div>
          }
        >
          <ul className="space-y-2 text-sm">
            <li>
              <strong>Patient:</strong> {patientId}
            </li>
            <li>
              <strong>Encounter:</strong> {encounterId ? encounterId : <em>(none)</em>}
            </li>
            <li>
              <strong>Category:</strong> {yakapOptions.find((o) => o.value === category)?.label}
            </li>
            <li>
              <strong>Subtype:</strong> {resolvedSubtype || <em>(none)</em>}
            </li>
            <li>
              <strong>Date taken:</strong> {takenAt || <em>—</em>}
            </li>
            <li>
              <strong>Provider:</strong> {provider || <em>—</em>}
            </li>
            {category !== "ecg" && chosenOption.needsImpression && (
              <li>
                <strong>Impression:</strong> {impression || <em>—</em>}
              </li>
            )}
            {!!files.length && (
              <li>
                <strong>Files:</strong> {files.map((f) => f.file.name).join(", ")}
              </li>
            )}
          </ul>

          {resultMsg && (
            <div className="mt-4">
              <button
                className="w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
                onClick={resetAfterSubmit}
              >
                Add another
              </button>
            </div>
          )}
        </SectionCard>
      )}

      {/* Footer nav */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="w-full rounded-lg border px-4 py-2 disabled:opacity-50 sm:w-auto"
        >
          Back
        </button>
        <button
          onClick={() => setStep((s) => Math.min(5, s + 1))}
          disabled={step >= 5}
          className="w-full rounded-lg px-4 py-2 text-white disabled:opacity-50 sm:w-auto"
          style={{ backgroundColor: ACCENT }}
        >
          Next
        </button>
      </div>
    </main>
  );
}

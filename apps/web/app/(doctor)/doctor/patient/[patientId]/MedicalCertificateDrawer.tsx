"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createDefaultPhysicalExam,
  PHYSICAL_EXAM_SECTIONS,
  PhysicalExamKey,
  PhysicalExamPayload,
  SupportingDataEntry,
} from "@/lib/medicalCertificateSchema";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  consultationId: string;
  encounterId: string;
  onIssued?: (certificate: any, info?: { isEdit: boolean }) => void;
};

type FormDataPayload = {
  patient: Record<string, any>;
  encounter: Record<string, any> | null;
  consultation: Record<string, any> | null;
  doctor: Record<string, any> | null;
  vitals_summary?: string | null;
  vitals?: Record<string, any> | null;
  diagnoses?: Array<Record<string, any>>;
  notes?: Record<string, any> | null;
  physical_exam?: PhysicalExamPayload;
  findings_summary?: string | null;
  defaults?: {
    diagnosis_text?: string | null;
    remarks?: string | null;
    advice?: string | null;
  };
  encounter_reference?: Record<string, any> | null;
  consultation_reference?: Record<string, any> | null;
};

type SupportingSuggestion = {
  key: string;
  type: string;
  label: string;
  summary: string;
  source_id?: string | null;
  checked: boolean;
};

type LabSearchResult = {
  id: string;
  date_iso: string | null;
  display_date: string;
  label: string;
  summary: string;
};

type CustomSupportingEntry = {
  id: string;
  label: string;
  summary: string;
  type?: string;
  source_id?: string | null;
  meta?: Record<string, any>;
};

type DraftPayload = {
  updatedAt: string;
  physicalExam: PhysicalExamPayload;
  diagnosisText: string;
  remarks: string;
  advice: string;
  findingsSummary: string;
  suggestions: SupportingSuggestion[];
  customSupporting: CustomSupportingEntry[];
};

type MedCertFormState = {
  physicalExam: PhysicalExamPayload;
  diagnosisText: string;
  remarks: string;
  advice: string;
  findingsSummary: string;
  suggestions: SupportingSuggestion[];
  customSupporting: CustomSupportingEntry[];
};

const formatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(+dt) ? iso : formatter.format(dt);
}

function formatBirthday(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(+dt)
    ? iso
    : new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(dt);
}

function computeAge(birthday?: string | null) {
  if (!birthday) return null;
  const dob = new Date(birthday);
  if (Number.isNaN(+dob)) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function generateClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function getMedCertDraftKey({
  doctorId,
  patientId,
  encounterId,
  date,
}: {
  doctorId: string;
  patientId: string;
  encounterId: string;
  date: string;
}) {
  return `med-cert-draft:v1:${doctorId}:${patientId}:${encounterId}:${date}`;
}

function isSameDay(iso?: string | null, dayKey?: string) {
  if (!iso || !dayKey) return false;
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return false;
  return dt.toLocaleDateString("en-CA") === dayKey;
}

function createEmptyFormState(): MedCertFormState {
  return {
    physicalExam: createDefaultPhysicalExam(),
    diagnosisText: "",
    remarks: "",
    advice: "",
    findingsSummary: "",
    suggestions: [],
    customSupporting: [],
  };
}

function mapSuggestions(data: any[]): SupportingSuggestion[] {
  return data.map((item: any, idx: number) => ({
    key: `suggestion-${item.source_id || idx}`,
    type: item.type || "note",
    label: item.label || "Supporting data",
    summary: item.summary || "",
    source_id: item.source_id || null,
    checked: true,
  }));
}

function certificateToFormState(cert: any): MedCertFormState {
  const mappedSupporting = Array.isArray(cert?.supporting_data)
    ? cert.supporting_data.map((entry: any) => ({
        id: generateClientId(),
        label: entry.label || "",
        summary: entry.summary || "",
        type: entry.type || "custom",
        source_id: entry.source_id || null,
      }))
    : [];

  return {
    physicalExam: cert?.physical_exam || createDefaultPhysicalExam(),
    diagnosisText: cert?.diagnosis_text || "",
    remarks: cert?.remarks || "",
    advice: cert?.advice || "",
    findingsSummary: cert?.findings_summary || "",
    suggestions: [],
    customSupporting: mappedSupporting,
  };
}

function defaultsToFormState(data: FormDataPayload | null): MedCertFormState {
  if (!data) return createEmptyFormState();
  return {
    physicalExam: data.physical_exam || createDefaultPhysicalExam(),
    diagnosisText: data.defaults?.diagnosis_text || "",
    remarks: data.defaults?.remarks || "",
    advice: data.defaults?.advice || "",
    findingsSummary: data.findings_summary || "",
    suggestions: [],
    customSupporting: [],
  };
}

export default function MedicalCertificateDrawer({
  open,
  onClose,
  patientId,
  consultationId,
  encounterId,
  onIssued,
}: DrawerProps) {
  const [loading, setLoading] = useState(false);
  const [supportingLoading, setSupportingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormDataPayload | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<MedCertFormState>(() => createEmptyFormState());
  const [history, setHistory] = useState<Array<any>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [existingCertificate, setExistingCertificate] = useState<any | null>(null);
  const [existingLoading, setExistingLoading] = useState(false);
  const [labSearch, setLabSearch] = useState("");
  const [labResults, setLabResults] = useState<LabSearchResult[]>([]);
  const [labSearchLoading, setLabSearchLoading] = useState(false);
  const [labSearchError, setLabSearchError] = useState<string | null>(null);
  const issueDateKey = useMemo(() => new Date().toLocaleDateString("en-CA"), [open]);
  const draftRef = useRef<DraftPayload | null>(null);
  const hasInitializedRef = useRef(false);
  const doctorKey = formData?.doctor?.doctor_id || "reliever-doctor";
  const draftKey = useMemo(
    () => getMedCertDraftKey({ doctorId: doctorKey, patientId, encounterId, date: issueDateKey }),
    [doctorKey, patientId, encounterId, issueDateKey],
  );

  function loadDraftFromStorage(): DraftPayload | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftPayload;
      if (!parsed?.updatedAt) return null;
      return parsed;
    } catch (err) {
      console.warn("medcert draft read failed", err);
      return null;
    }
  }

  function persistDraftToStorage(next: MedCertFormState) {
    if (typeof window === "undefined") return;
    try {
      const payload: DraftPayload = { updatedAt: new Date().toISOString(), ...next };
      localStorage.setItem(draftKey, JSON.stringify(payload));
      draftRef.current = payload;
    } catch (err) {
      console.warn("medcert draft save failed", err);
    }
  }

  function hydrateFromDraft(draft: DraftPayload) {
    setFormState({
      physicalExam: draft.physicalExam || createDefaultPhysicalExam(),
      diagnosisText: draft.diagnosisText || "",
      remarks: draft.remarks || "",
      advice: draft.advice || "",
      findingsSummary: draft.findingsSummary || "",
      suggestions: draft.suggestions || [],
      customSupporting: draft.customSupporting || [],
    });
  }

  function clearDraft(key?: string) {
    const targetKey = key || draftKey;
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(targetKey);
      } catch (err) {
        console.warn("medcert draft clear failed", err);
      }
    }
    draftRef.current = null;
  }

  useEffect(() => {
    // reset when switching to a new context
    setFormData(null);
    setExistingCertificate(null);
    setHistory([]);
    setError(null);
    setSuccessMessage(null);
    setFormState(createEmptyFormState());
    hasInitializedRef.current = false;
    clearDraft();
    setLabResults([]);
    setLabSearch("");
    setLabSearchError(null);
    setHistoryLoading(false);
    setExistingLoading(false);
    setSupportingLoading(false);
  }, [patientId, consultationId, encounterId, issueDateKey]);

  useEffect(() => {
    if (!hasInitializedRef.current) return;
    persistDraftToStorage(formState);
  }, [formState, draftKey]);

  useEffect(() => {
    if (!open) return;

    let ignore = false;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const params = new URLSearchParams({
          patient_id: patientId,
          consultation_id: consultationId,
          encounter_id: encounterId,
        });
        const res = await fetch(`/api/doctor/medical-certificates/form-data?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
        if (ignore) return;
        setFormData(data);
      } catch (err: any) {
        if (ignore) return;
        setError(err?.message || "Failed to load data.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [open, patientId, consultationId, encounterId]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    async function loadSuggestions() {
      setSupportingLoading(true);
      try {
        const params = new URLSearchParams({
          patient_id: patientId,
          consultation_id: consultationId,
          encounter_id: encounterId,
        });
        const res = await fetch(`/api/doctor/medical-certificates/supporting-data?${params}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
        if (ignore) return;
        const mapped = mapSuggestions(data.suggestions || []);
        setFormState((prev) => {
          if (prev.suggestions.length > 0) return prev;
          if (draftRef.current?.suggestions?.length) {
            return { ...prev, suggestions: draftRef.current.suggestions };
          }
          return { ...prev, suggestions: mapped };
        });
      } catch (err: any) {
        if (!ignore) {
          console.warn("supporting data load error", err);
        }
      } finally {
        if (!ignore) setSupportingLoading(false);
      }
    }
    loadSuggestions();
    return () => {
      ignore = true;
    };
  }, [open, patientId, consultationId, encounterId]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          patient_id: patientId,
          limit: "5",
        });
        const res = await fetch(`/api/doctor/medical-certificates?${params}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
        if (ignore) return;
        setHistory(data.items || []);
      } catch (err) {
        if (!ignore) console.warn("history load failed", err);
      } finally {
        if (!ignore) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => {
      ignore = true;
    };
  }, [open, patientId]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    async function loadExistingCertificate() {
      if (!consultationId) return;
      setExistingLoading(true);
      try {
        const params = new URLSearchParams({
          patient_id: patientId,
          consultation_id: consultationId,
          limit: "1",
        });
        const res = await fetch(`/api/doctor/medical-certificates?${params}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
        if (ignore) return;
        const match = Array.isArray(data.items) ? data.items[0] : null;
        if (!match?.id) {
          setExistingCertificate(null);
          return;
        }
        const detailRes = await fetch(`/api/doctor/medical-certificates/${match.id}`, {
          cache: "no-store",
        });
        const detail = await detailRes.json();
        if (!detailRes.ok) throw new Error(detail?.error || `Failed (${detailRes.status})`);
        if (ignore) return;
        if (detail?.certificate) {
          setExistingCertificate(detail.certificate);
        }
      } catch (err) {
        if (!ignore) console.warn("existing cert load failed", err);
      } finally {
        if (!ignore) setExistingLoading(false);
      }
    }
    loadExistingCertificate();
    return () => {
      ignore = true;
    };
  }, [open, patientId, consultationId]);

  useEffect(() => {
    if (!open) return;
    if (hasInitializedRef.current) return;
    if (!formData) return;
    if (existingLoading) return;
    const existingSuggestions = formState.suggestions || [];

    const draft = loadDraftFromStorage();
    if (draft) {
      hydrateFromDraft(draft);
      draftRef.current = draft;
      hasInitializedRef.current = true;
      return;
    }

    const todaysCert =
      existingCertificate && isSameDay(existingCertificate?.issued_at, issueDateKey)
        ? existingCertificate
        : null;
    if (todaysCert) {
      const next = certificateToFormState(todaysCert);
      setFormState({
        ...next,
        suggestions: existingSuggestions.length ? existingSuggestions : next.suggestions,
      });
      draftRef.current = null;
      hasInitializedRef.current = true;
      return;
    }

    const defaults = defaultsToFormState(formData);
    setFormState({
      ...defaults,
      suggestions: existingSuggestions.length ? existingSuggestions : defaults.suggestions,
    });
    draftRef.current = null;
    hasInitializedRef.current = true;
  }, [open, formData, existingCertificate, existingLoading, issueDateKey, draftKey]);

  function closeDrawer() {
    onClose();
  }

  function updateExam(
    key: PhysicalExamKey,
    values: Partial<{ status: "normal" | "abnormal"; remarks: string }>,
  ) {
    setFormState((prev) => ({
      ...prev,
      physicalExam: {
        ...prev.physicalExam,
        [key]: {
          status: values.status ?? prev.physicalExam[key]?.status ?? "normal",
          remarks: values.remarks ?? prev.physicalExam[key]?.remarks ?? "",
        },
      },
    }));
  }

  function toggleSuggestion(idx: number, checked: boolean) {
    setFormState((prev) => ({
      ...prev,
      suggestions: prev.suggestions.map((item, i) => (i === idx ? { ...item, checked } : item)),
    }));
  }

  function addCustomSupporting() {
    const id = generateClientId();
    setFormState((prev) => ({
      ...prev,
      customSupporting: [...prev.customSupporting, { id, label: "", summary: "", type: "custom" }],
    }));
  }

  function updateCustom(id: string, patch: Partial<{ label: string; summary: string }>) {
    setFormState((prev) => ({
      ...prev,
      customSupporting: prev.customSupporting.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeCustom(id: string) {
    setFormState((prev) => ({
      ...prev,
      customSupporting: prev.customSupporting.filter((item) => item.id !== id),
    }));
  }

  function handleDiscardDraft() {
    const todaysCert =
      existingCertificate && isSameDay(existingCertificate?.issued_at, issueDateKey)
        ? existingCertificate
        : null;
    clearDraft(draftKey);
    const baseState = todaysCert
      ? certificateToFormState(todaysCert)
      : defaultsToFormState(formData);
    const nextState = { ...baseState, suggestions: formState.suggestions };
    hasInitializedRef.current = true;
    setFormState(nextState);
    setSuccessMessage(null);
    setError(null);
  }

  async function executeLabSearch(e?: FormEvent) {
    if (e) e.preventDefault();
    const query = labSearch.trim();
    if (query.length < 2) {
      setLabSearchError("Enter at least 2 characters");
      return;
    }
    setLabSearchLoading(true);
    setLabSearchError(null);
    try {
      const params = new URLSearchParams({
        patient_id: patientId,
        q: query,
      });
      const res = await fetch(`/api/doctor/medical-certificates/labs/search?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      setLabResults(data?.labs || []);
      if (!data?.labs?.length) {
        setLabSearchError("No matching analytes found for this patient.");
      }
    } catch (err: any) {
      setLabSearchError(err?.message || "Search failed");
      setLabResults([]);
    } finally {
      setLabSearchLoading(false);
    }
  }

  function addLabResult(result: LabSearchResult) {
    const dateKey = result.date_iso ? result.date_iso.slice(0, 10) : "recent";
    const label = `Lab tests done (${result.display_date})`;
    setFormState((prev) => {
      const next = [...prev.customSupporting];
      const idx = next.findIndex(
        (entry) => entry.meta?.kind === "lab" && entry.meta?.date === dateKey,
      );
      if (idx >= 0) {
        const entry = next[idx];
        const lines: string[] = entry.meta?.lines
          ? [...entry.meta.lines]
          : entry.summary
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean);
        if (!lines.includes(result.summary)) {
          lines.push(result.summary);
          entry.summary = lines.join("; ");
          entry.meta = { ...(entry.meta || {}), lines, kind: "lab", date: dateKey };
        }
        next[idx] = { ...entry };
      } else {
        next.push({
          id: generateClientId(),
          label,
          summary: result.summary,
          type: "labs",
          source_id: result.date_iso || null,
          meta: { kind: "lab", date: dateKey, lines: [result.summary] },
        });
      }
      return { ...prev, customSupporting: next };
    });
  }

  const isEditing = Boolean(existingCertificate);
  const issueDate = useMemo(() => new Date(`${issueDateKey}T00:00:00`), [issueDateKey]);
  const validUntil = useMemo(
    () => new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000),
    [issueDate],
  );
  const displayIssuedAt = existingCertificate?.issued_at || issueDate.toISOString();
  const displayValidUntil = existingCertificate?.valid_until || validUntil.toISOString();

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const selectedSuggestions: SupportingDataEntry[] = formState.suggestions
        .filter((s) => s.checked && s.summary)
        .map((s) => ({
          type: s.type,
          label: s.label,
          summary: s.summary,
          source_id: s.source_id || null,
        }));

      const customEntries: SupportingDataEntry[] = formState.customSupporting
        .map((entry) => ({
          type: entry.type || "custom",
          label: entry.label.trim(),
          summary: entry.summary.trim(),
          source_id: entry.source_id || null,
        }))
        .filter((entry) => entry.label && entry.summary);

      const payload = {
        patient_id: patientId,
        consultation_id: consultationId,
        encounter_id: encounterId,
        physical_exam: formState.physicalExam,
        diagnosis_text: formState.diagnosisText,
        remarks: formState.remarks,
        advice: formState.advice,
        findings_summary: formState.findingsSummary || null,
        supporting_data: [...selectedSuggestions, ...customEntries],
      };

      const endpoint = isEditing
        ? `/api/doctor/medical-certificates/${existingCertificate?.id}`
        : "/api/doctor/medical-certificates/generate";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data?.certificate_id) {
          try {
            const detailRes = await fetch(
              `/api/doctor/medical-certificates/${data.certificate_id}`,
              {
                cache: "no-store",
              },
            );
            const detail = await detailRes.json();
            if (detailRes.ok && detail?.certificate) {
              setExistingCertificate(detail.certificate);
              setFormState((prev) => {
                const next = certificateToFormState(detail.certificate);
                return { ...next, suggestions: prev.suggestions };
              });
              setError(
                "A certificate already exists for this consultation. Loaded it for editing.",
              );
              return;
            }
          } catch (loadErr) {
            console.warn("conflict load failed", loadErr);
          }
        }
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      const message = isEditing ? "Medical certificate updated." : "Medical certificate generated.";
      setSuccessMessage(message);
      if (data?.certificate) {
        setExistingCertificate(data.certificate);
        setFormState((prev) => {
          const next = certificateToFormState(data.certificate);
          return { ...next, suggestions: prev.suggestions };
        });
        setHistory((prev) => {
          const filtered = prev.filter((item) => item.id !== data.certificate.id);
          return [data.certificate, ...filtered].slice(0, 5);
        });
        if (!isEditing && typeof window !== "undefined" && data.certificate.id) {
          window.open(`/doctor/medical-certificates/${data.certificate.id}/print`, "_blank");
        }
        persistDraftToStorage({
          ...certificateToFormState(data.certificate),
          suggestions: formState.suggestions,
        });
      }
      onIssued?.(data.certificate, { isEdit: isEditing });
    } catch (err: any) {
      setError(err?.message || "Failed to create certificate.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const patientName = formData?.patient?.full_name || patientId;
  const patientAddress = formData?.patient?.address || "—";
  const birthday = formatBirthday(formData?.patient?.birthday);
  const age = formData?.patient?.age ?? computeAge(formData?.patient?.birthday || null);
  const sex = (formData?.patient?.sex || "").toString().toUpperCase();

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-end bg-black/40">
      <div className="h-full w-full max-w-4xl bg-white shadow-2xl flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#44969b]">
              {isEditing ? "Editing existing certificate" : "Certificate Builder"}
            </p>
            <h2 className="text-xl font-semibold">Medical Certificate</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Issuance: {formatDate(displayIssuedAt)} · Valid until {formatDate(displayValidUntil)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {existingCertificate && (
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `/doctor/medical-certificates/${existingCertificate.id}/print`,
                    "_blank",
                  )
                }
                className="rounded-full border border-[#2e6468] px-4 py-1 text-sm font-medium text-[#2e6468]"
              >
                View Print
              </button>
            )}
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-full border border-gray-300 px-4 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-20 pt-4 space-y-6">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}
          {isEditing && existingCertificate && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Editing certificate <b>{existingCertificate.certificate_no}</b>. Changes will update
              the existing record.
            </div>
          )}

          <section className="rounded-xl border bg-gray-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Patient</p>
                <h3 className="text-lg font-semibold text-gray-900">{patientName}</h3>
              </div>
              <img
                src="/wellserv-logo.png"
                alt="Wellserv"
                className="h-10 w-auto opacity-80"
                loading="lazy"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-700">
              <div>
                <span className="text-gray-500">Patient ID:</span> {patientId}
              </div>
              <div>
                <span className="text-gray-500">Sex:</span> {sex || "—"}
              </div>
              <div>
                <span className="text-gray-500">Age:</span> {age ?? "—"}
              </div>
              <div>
                <span className="text-gray-500">DOB:</span> {birthday}
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Address:</span> {patientAddress}
              </div>
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <h3 className="font-semibold text-gray-800">References</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-700">
              <div>
                <div className="text-gray-500 text-xs uppercase tracking-wide">Consultation</div>
                <div>{formData?.consultation_reference?.id || consultationId}</div>
                <div className="text-xs text-gray-500">
                  {formData?.consultation_reference?.visit_at
                    ? formatDate(formData.consultation_reference.visit_at)
                    : null}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase tracking-wide">Encounter</div>
                <div>{formData?.encounter_reference?.id || encounterId}</div>
                <div className="text-xs text-gray-500">
                  {formData?.encounter_reference?.branch || "—"}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Physical Examination</h3>
              <p className="text-xs text-gray-500">
                Click Normal / Abnormal and add remarks as needed.
              </p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {PHYSICAL_EXAM_SECTIONS.map(({ key, label }) => {
                const entry = formState.physicalExam[key];
                return (
                  <div key={key} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm font-medium text-gray-800">
                      <span>{label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                            entry?.status === "normal"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                          onClick={() => updateExam(key as PhysicalExamKey, { status: "normal" })}
                        >
                          Normal
                        </button>
                        <button
                          type="button"
                          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                            entry?.status === "abnormal"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                          onClick={() => updateExam(key as PhysicalExamKey, { status: "abnormal" })}
                        >
                          Abnormal
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="mt-2 w-full rounded border px-2 py-1 text-sm"
                      rows={2}
                      placeholder="Remarks"
                      value={entry?.remarks || ""}
                      onChange={(e) =>
                        updateExam(key as PhysicalExamKey, { remarks: e.target.value })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <div>
              <label className="text-sm font-semibold text-gray-800">Diagnosis</label>
              <textarea
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                rows={3}
                value={formState.diagnosisText}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, diagnosisText: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-800">Findings Summary</label>
              <textarea
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                rows={3}
                value={formState.findingsSummary}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, findingsSummary: e.target.value }))
                }
                placeholder="Optional overview of pertinent findings."
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-gray-800">Remarks</label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  rows={4}
                  value={formState.remarks}
                  onChange={(e) => setFormState((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="e.g., Fit for work, Unfit for work for x days…"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800">Advice</label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  rows={4}
                  value={formState.advice}
                  onChange={(e) => setFormState((prev) => ({ ...prev, advice: e.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Supporting Data</h3>
              {supportingLoading && <span className="text-xs text-gray-400">Loading…</span>}
            </div>
            <div className="mt-3 space-y-3">
              {formState.suggestions.length === 0 && (
                <p className="text-sm text-gray-500">
                  No automatic suggestions found for this encounter.
                </p>
              )}
              {formState.suggestions.map((item, idx) => (
                <label key={item.key} className="flex gap-3 rounded border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={item.checked}
                    onChange={(e) => toggleSuggestion(idx, e.target.checked)}
                  />
                  <div>
                    <div className="font-medium text-gray-800">{item.label}</div>
                    <div className="text-gray-600">{item.summary}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">Add Lab Tests</h4>
              </div>
              <form onSubmit={executeLabSearch} className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  placeholder="Search analyte (e.g., cholesterol)"
                  className="flex-1 rounded border px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={labSearchLoading}
                  className="rounded bg-[#2e6468] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {labSearchLoading ? "Searching…" : "Search"}
                </button>
              </form>
              {labSearchError && <p className="mt-2 text-xs text-rose-600">{labSearchError}</p>}
              {labResults.length > 0 && (
                <div className="mt-3 space-y-2 rounded-lg border bg-gray-50/80 p-3">
                  {labResults.map((res) => (
                    <div key={res.id} className="rounded border bg-white px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-gray-800">{res.label}</div>
                          <div className="text-xs text-gray-500">{res.display_date}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addLabResult(res)}
                          className="rounded-full border border-[#2e6468] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#2e6468]"
                        >
                          Add
                        </button>
                      </div>
                      <div className="mt-1 text-gray-600">{res.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">Custom entries</h4>
                <button
                  type="button"
                  onClick={addCustomSupporting}
                  className="text-xs font-semibold uppercase tracking-wide text-[#2e6468]"
                >
                  + Add entry
                </button>
              </div>
              {formState.customSupporting.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  Add manual supporting statements that will appear on the certificate.
                </p>
              )}
              <div className="mt-2 space-y-3">
                {formState.customSupporting.map((entry) => (
                  <div key={entry.id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase text-gray-500">Label</label>
                      <button
                        type="button"
                        onClick={() => removeCustom(entry.id)}
                        className="text-xs text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      value={entry.label}
                      onChange={(e) => updateCustom(entry.id, { label: e.target.value })}
                      placeholder="e.g., Imaging"
                    />
                    <label className="mt-2 text-xs font-semibold uppercase text-gray-500">
                      Summary
                    </label>
                    <textarea
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      rows={2}
                      value={entry.summary}
                      onChange={(e) => updateCustom(entry.id, { summary: e.target.value })}
                      placeholder="Include short statement…"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Recent Certificates</h3>
              {historyLoading && <span className="text-xs text-gray-400">Loading…</span>}
            </div>
            {history.length === 0 && !historyLoading && (
              <p className="mt-2 text-sm text-gray-500">
                No certificates issued for this patient yet.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-semibold text-gray-800">{item.certificate_no}</div>
                    <div className="text-xs text-gray-500">
                      Issued {formatDate(item.issued_at)} • Status {item.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(`/doctor/medical-certificates/${item.id}/print`, "_blank")
                    }
                    className="rounded-full border border-[#2e6468] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#2e6468]"
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="sticky bottom-0 w-full border-t bg-white px-5 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-gray-500">
              Certificates are saved to the patient record with a 30-day validity by default.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                disabled={saving}
              >
                Discard draft
              </button>
              <button
                type="button"
                disabled={saving || loading}
                onClick={handleSubmit}
                className="inline-flex items-center justify-center rounded-full bg-[#2e6468] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Generating…" : "Generate certificate"}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

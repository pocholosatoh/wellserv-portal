// app/staff/(protected)/referrals/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtManila } from "@/lib/time";
import { TodayPatientsQuickList } from "@/app/staff/_components/TodayPatientsQuickList";

type ReferralListItem = {
  id: string;
  referral_code: string | null;
  created_at: string | null;
  patient_id: string | null;
  patient_full_name: string | null;
  referred_to_doctor_name: string | null;
  referred_to_specialty_name: string | null;
};

type Specialty = {
  id: string;
  code: string | null;
  name: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type Affiliation = {
  id: string;
  referral_doctor_id: string;
  institution_name: string;
  address_line: string;
  contact_numbers: string | null;
  schedule_text: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type Doctor = {
  id: string;
  full_name: string;
  specialty_id: string;
  specialty_name: string | null;
  specialty_code: string | null;
  credentials: string | null;
  prc_no: string | null;
  is_active: boolean | null;
  affiliations: Affiliation[];
};

type DirectoryData = {
  doctors: Doctor[];
  specialties: Specialty[];
};

type DoctorFormState = {
  id: string | null;
  full_name: string;
  specialty_id: string;
  credentials: string;
  prc_no: string;
  is_active: boolean;
};

type AffiliationFormState = {
  id: string | null;
  referral_doctor_id: string;
  institution_name: string;
  address_line: string;
  contact_numbers: string;
  schedule_text: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_DOCTOR_FORM: DoctorFormState = {
  id: null,
  full_name: "",
  specialty_id: "",
  credentials: "",
  prc_no: "",
  is_active: true,
};

const EMPTY_AFFILIATION_FORM: AffiliationFormState = {
  id: null,
  referral_doctor_id: "",
  institution_name: "",
  address_line: "",
  contact_numbers: "",
  schedule_text: "",
  sort_order: "",
  is_active: true,
};

function normalizePatientId(value: string) {
  return value.trim().toUpperCase();
}

function sanitizePrcNo(value: string) {
  return value.replace(/\D+/g, "");
}

function formatSpecialtyLabel(spec?: Specialty | null) {
  if (!spec) return "Unassigned specialty";
  return spec.name || spec.code || "Unlabeled specialty";
}

function formatDoctorSpecialty(doctor: Doctor) {
  return doctor.specialty_name || doctor.specialty_code || "Unassigned specialty";
}

function statusBadgeClass(isActive?: boolean | null) {
  return isActive
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-gray-100 text-gray-600 ring-gray-200";
}

export default function StaffReferralsPage() {
  const [patientId, setPatientId] = useState("");
  const [list, setList] = useState<ReferralListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directory, setDirectory] = useState<DirectoryData | null>(null);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [doctorForm, setDoctorForm] = useState<DoctorFormState>({ ...EMPTY_DOCTOR_FORM });
  const [doctorFormError, setDoctorFormError] = useState<string | null>(null);
  const [doctorSaving, setDoctorSaving] = useState(false);

  const [affiliationsModalOpen, setAffiliationsModalOpen] = useState(false);
  const [affiliationsDoctorId, setAffiliationsDoctorId] = useState<string | null>(null);
  const [affiliationModalOpen, setAffiliationModalOpen] = useState(false);
  const [affiliationForm, setAffiliationForm] = useState<AffiliationFormState>({
    ...EMPTY_AFFILIATION_FORM,
  });
  const [affiliationFormError, setAffiliationFormError] = useState<string | null>(null);
  const [affiliationSaving, setAffiliationSaving] = useState(false);

  const normalizedInput = normalizePatientId(patientId);
  const showEmptyPrompt = !normalizedInput;
  const showNoResults = hasSearched && !loading && !err && list.length === 0;

  const selectedDoctor = useMemo(() => {
    return directory?.doctors.find((doc) => doc.id === selectedDoctorId) || null;
  }, [directory, selectedDoctorId]);

  const affiliationsDoctor = useMemo(() => {
    return directory?.doctors.find((doc) => doc.id === affiliationsDoctorId) || null;
  }, [directory, affiliationsDoctorId]);

  const filteredDoctors = useMemo(() => {
    const docs = directory?.doctors ?? [];
    const query = doctorSearch.trim().toLowerCase();
    if (!query) return docs;
    return docs.filter((doc) => {
      const specialty = formatDoctorSpecialty(doc).toLowerCase();
      return (
        doc.full_name.toLowerCase().includes(query) ||
        specialty.includes(query) ||
        (doc.credentials || "").toLowerCase().includes(query)
      );
    });
  }, [directory, doctorSearch]);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const res = await fetch("/api/staff/referrals/directory", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load directory");
      const payload = {
        doctors: (json?.doctors as Doctor[]) || [],
        specialties: (json?.specialties as Specialty[]) || [],
      };
      setDirectory(payload);
      setSelectedDoctorId((prev) =>
        prev && payload.doctors.some((doc) => doc.id === prev) ? prev : null,
      );
      setAffiliationsDoctorId((prev) =>
        prev && payload.doctors.some((doc) => doc.id === prev) ? prev : null,
      );
    } catch (e: any) {
      setDirectoryError(e?.message || "Failed to load directory");
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!directoryOpen) return;
    loadDirectory();
  }, [directoryOpen, loadDirectory]);

  async function search(idOverride?: string) {
    const normalized = normalizePatientId(idOverride ?? patientId);
    if (!normalized) {
      setHasSearched(false);
      setList([]);
      setErr(null);
      return;
    }

    setPatientId(normalized);
    setHasSearched(true);
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/staff/referrals?patient_id=${encodeURIComponent(normalized)}`,
        {
          cache: "no-store",
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load referrals");
      setList((json?.referrals as ReferralListItem[]) || []);
    } catch (e: any) {
      setErr(e?.message || "Network error");
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  const handlePickPatient = (pid: string) => {
    const normalized = normalizePatientId(pid);
    setPatientId(normalized);
    search(normalized);
  };

  const openDoctorModal = (doc?: Doctor | null) => {
    if (doc) {
      setDoctorForm({
        id: doc.id,
        full_name: doc.full_name || "",
        specialty_id: doc.specialty_id || "",
        credentials: doc.credentials || "",
        prc_no: doc.prc_no || "",
        is_active: doc.is_active !== false,
      });
    } else {
      setDoctorForm({ ...EMPTY_DOCTOR_FORM });
    }
    setDoctorFormError(null);
    setDoctorModalOpen(true);
  };

  const openAffiliationsModal = (doc: Doctor) => {
    setAffiliationsDoctorId(doc.id);
    setAffiliationsModalOpen(true);
  };

  const openAffiliationModal = (doctor: Doctor, affiliation?: Affiliation) => {
    if (affiliation) {
      setAffiliationForm({
        id: affiliation.id,
        referral_doctor_id: affiliation.referral_doctor_id,
        institution_name: affiliation.institution_name || "",
        address_line: affiliation.address_line || "",
        contact_numbers: affiliation.contact_numbers || "",
        schedule_text: affiliation.schedule_text || "",
        sort_order:
          affiliation.sort_order === null || affiliation.sort_order === undefined
            ? ""
            : String(affiliation.sort_order),
        is_active: affiliation.is_active !== false,
      });
    } else {
      setAffiliationForm({
        ...EMPTY_AFFILIATION_FORM,
        referral_doctor_id: doctor.id,
      });
    }
    setAffiliationFormError(null);
    setAffiliationModalOpen(true);
  };

  const saveDoctor = async () => {
    setDoctorFormError(null);
    const fullName = doctorForm.full_name.trim();
    const specialtyId = doctorForm.specialty_id.trim();
    if (!fullName) {
      setDoctorFormError("Full name is required.");
      return;
    }
    if (!specialtyId) {
      setDoctorFormError("Specialty is required.");
      return;
    }

    setDoctorSaving(true);
    try {
      const payload = {
        id: doctorForm.id,
        full_name: fullName,
        specialty_id: specialtyId,
        credentials: doctorForm.credentials.trim() || null,
        prc_no: sanitizePrcNo(doctorForm.prc_no) || null,
        is_active: doctorForm.is_active,
      };
      const res = await fetch("/api/staff/referrals/doctors", {
        method: doctorForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save doctor");
      setDoctorModalOpen(false);
      await loadDirectory();
    } catch (e: any) {
      setDoctorFormError(e?.message || "Failed to save doctor");
    } finally {
      setDoctorSaving(false);
    }
  };

  const deactivateDoctor = async (doc: Doctor) => {
    if (!doc.is_active) return;
    const ok = window.confirm(
      `Deactivate ${doc.full_name}? This hides the doctor from future referrals. Existing referrals are unchanged.`,
    );
    if (!ok) return;

    try {
      const res = await fetch("/api/staff/referrals/doctors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id, is_active: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to deactivate doctor");
      await loadDirectory();
    } catch (e: any) {
      setDirectoryError(e?.message || "Failed to deactivate doctor");
    }
  };

  const saveAffiliation = async () => {
    setAffiliationFormError(null);
    const institutionName = affiliationForm.institution_name.trim();
    const addressLine = affiliationForm.address_line.trim();
    if (!affiliationForm.referral_doctor_id) {
      setAffiliationFormError("Doctor is required.");
      return;
    }
    if (!institutionName) {
      setAffiliationFormError("Institution name is required.");
      return;
    }
    if (!addressLine) {
      setAffiliationFormError("Address line is required.");
      return;
    }

    const sortRaw = affiliationForm.sort_order.trim();
    const sortOrder = sortRaw ? Number(sortRaw) : null;
    if (sortRaw && !Number.isFinite(sortOrder)) {
      setAffiliationFormError("Sort order must be a number.");
      return;
    }

    setAffiliationSaving(true);
    try {
      const payload = {
        id: affiliationForm.id,
        referral_doctor_id: affiliationForm.referral_doctor_id,
        institution_name: institutionName,
        address_line: addressLine,
        contact_numbers: affiliationForm.contact_numbers.trim() || null,
        schedule_text: affiliationForm.schedule_text.trim() || null,
        sort_order: sortOrder,
        is_active: affiliationForm.is_active,
      };
      const res = await fetch("/api/staff/referrals/affiliations", {
        method: affiliationForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save affiliation");
      setAffiliationModalOpen(false);
      await loadDirectory();
    } catch (e: any) {
      setAffiliationFormError(e?.message || "Failed to save affiliation");
    } finally {
      setAffiliationSaving(false);
    }
  };

  const deactivateAffiliation = async (affiliation: Affiliation) => {
    if (!affiliation.is_active) return;
    const ok = window.confirm(
      "Deactivate this affiliation? It will no longer appear for new referrals.",
    );
    if (!ok) return;

    try {
      const res = await fetch("/api/staff/referrals/affiliations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: affiliation.id, is_active: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to deactivate affiliation");
      await loadDirectory();
    } catch (e: any) {
      setDirectoryError(e?.message || "Failed to deactivate affiliation");
    }
  };

  const closeDirectory = () => {
    setDirectoryOpen(false);
    setDoctorModalOpen(false);
    setAffiliationsModalOpen(false);
    setAffiliationModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Referrals</h1>
        <p className="mt-1 text-sm text-gray-600">Search and print patient referral forms.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <TodayPatientsQuickList
          onSelectPatient={handlePickPatient}
          actionLabel="Load referrals"
          className="self-start lg:sticky lg:top-24"
        />

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
            >
              <label className="flex-1 text-sm font-medium text-gray-700">
                Patient ID
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-base uppercase tracking-wide"
                  placeholder="Patient ID..."
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm"
                disabled={loading}
              >
                {loading ? "Loading..." : "Search"}
              </button>
            </form>
            <p className="mt-2 text-xs text-gray-500">Tip: We normalize the ID to uppercase.</p>
          </section>

          {err && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 shadow-sm">
              {err}
            </div>
          )}

          {showEmptyPrompt ? (
            <section className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
              Enter patient ID to search.
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Results</h2>
                  <p className="text-xs text-gray-500">
                    Patient <span className="font-mono">{normalizedInput}</span>
                  </p>
                </div>
                {loading && <span className="text-xs text-gray-500">Loading...</span>}
              </div>

              {showNoResults ? (
                <div className="border-t px-4 py-6 text-sm text-gray-500">
                  No referrals found for that patient.
                </div>
              ) : (
                <div className="border-t overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Created</th>
                        <th className="text-left font-medium px-3 py-2">Referral</th>
                        <th className="text-left font-medium px-3 py-2">Patient</th>
                        <th className="text-left font-medium px-3 py-2">Referred To</th>
                        <th className="text-left font-medium px-3 py-2">Status</th>
                        <th className="text-left font-medium px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((ref) => {
                        const printHref = `/doctor/referrals/${encodeURIComponent(ref.id)}/print`;
                        const patientLabel = ref.patient_full_name || ref.patient_id || "-";
                        const doctorLabel = ref.referred_to_doctor_name || "-";
                        const specialtyLabel = ref.referred_to_specialty_name || "-";
                        const referralLabel = ref.referral_code || ref.id;
                        return (
                          <tr key={ref.id} className="border-t">
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                              {fmtManila(ref.created_at)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">{referralLabel}</div>
                              {ref.referral_code && (
                                <div className="text-xs font-mono text-gray-500">{ref.id}</div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">{patientLabel}</div>
                              {ref.patient_id && (
                                <div className="text-xs font-mono text-gray-500">
                                  {ref.patient_id}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">{doctorLabel}</div>
                              <div className="text-xs text-gray-500">{specialtyLabel}</div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                Generated
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <a
                                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                                  href={printHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Print
                                </a>
                                <a
                                  className="text-xs font-medium text-gray-600 underline underline-offset-2"
                                  href={printHref}
                                >
                                  View
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Referral Directory</h2>
                <p className="text-sm text-gray-600">
                  Manage referral doctors and affiliations for future referrals.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm"
                onClick={() => setDirectoryOpen(true)}
              >
                Manage Referral Doctors
              </button>
            </div>
          </section>
        </div>
      </div>

      {directoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Referral Directory</h3>
                <p className="text-xs text-gray-500">
                  Changes apply to future referrals only.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDirectory}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="grid gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Doctors</h4>
                    <p className="text-xs text-gray-500">Search and manage referral doctors.</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                    onClick={() => openDoctorModal()}
                  >
                    + Add Doctor
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Search doctors..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-2 text-xs text-gray-700"
                    onClick={loadDirectory}
                    disabled={directoryLoading}
                  >
                    {directoryLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {directoryError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {directoryError}
                  </div>
                )}

                {directoryLoading && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500">
                    Loading directory...
                  </div>
                )}

                {!directoryLoading && filteredDoctors.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                    No doctors found.
                  </div>
                )}

                <div className="space-y-2">
                  {filteredDoctors.map((doc) => {
                    const isSelected = doc.id === selectedDoctorId;
                    return (
                      <div
                        key={doc.id}
                        className={[
                          "rounded-xl border px-3 py-2 shadow-sm transition",
                          isSelected ? "border-accent bg-accent/5" : "border-gray-200 bg-white",
                        ].join(" ")}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedDoctorId(doc.id);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {doc.full_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDoctorSpecialty(doc)}
                            </div>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusBadgeClass(
                              doc.is_active,
                            )}`}
                          >
                            {doc.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDoctorModal(doc);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAffiliationsModal(doc);
                            }}
                          >
                            Manage Affiliations
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-300 px-2 py-1 text-rose-600 disabled:opacity-60"
                            disabled={!doc.is_active}
                            onClick={(e) => {
                              e.stopPropagation();
                              deactivateDoctor(doc);
                            }}
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Doctor Overview</h4>
                  <p className="text-xs text-gray-500">
                    Select a doctor to see their affiliations.
                  </p>
                </div>

                {!selectedDoctor ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                    Select a doctor to see details and affiliations.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-gray-900">
                            {selectedDoctor.full_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatDoctorSpecialty(selectedDoctor)}
                          </div>
                          {selectedDoctor.credentials && (
                            <div className="text-xs text-gray-500">
                              Credentials: {selectedDoctor.credentials}
                            </div>
                          )}
                          {selectedDoctor.prc_no && (
                            <div className="text-xs text-gray-500">
                              PRC No: {selectedDoctor.prc_no}
                            </div>
                          )}
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusBadgeClass(
                            selectedDoctor.is_active,
                          )}`}
                        >
                          {selectedDoctor.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          className="rounded-md border px-3 py-1.5 text-xs text-gray-700"
                          onClick={() => openAffiliationsModal(selectedDoctor)}
                        >
                          Manage Affiliations
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-900">Affiliations</div>
                        <span className="text-xs text-gray-500">
                          {selectedDoctor.affiliations.length} total
                        </span>
                      </div>
                      {selectedDoctor.affiliations.length === 0 ? (
                        <div className="mt-3 text-sm text-gray-500">
                          No affiliations recorded yet.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {selectedDoctor.affiliations.map((aff) => (
                            <div
                              key={aff.id}
                              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {aff.institution_name}
                                  </div>
                                  <div className="text-xs text-gray-500">{aff.address_line}</div>
                                  {aff.schedule_text && (
                                    <div className="text-xs text-gray-500">
                                      {aff.schedule_text}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusBadgeClass(
                                    aff.is_active,
                                  )}`}
                                >
                                  {aff.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {doctorModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {doctorForm.id ? "Edit Doctor" : "Add Doctor"}
              </h3>
              <button
                type="button"
                onClick={() => setDoctorModalOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form
              className="space-y-4 px-5 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveDoctor();
              }}
            >
              <label className="block text-sm font-medium text-gray-700">
                Full name
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={doctorForm.full_name}
                  onChange={(e) =>
                    setDoctorForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  placeholder="Doctor full name"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Specialty
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={doctorForm.specialty_id}
                  onChange={(e) =>
                    setDoctorForm((prev) => ({ ...prev, specialty_id: e.target.value }))
                  }
                >
                  <option value="">Select specialty</option>
                  {(directory?.specialties || []).map((spec) => {
                    const label = formatSpecialtyLabel(spec);
                    const suffix = spec.is_active === false ? " (inactive)" : "";
                    return (
                      <option key={spec.id} value={spec.id}>
                        {label}
                        {suffix}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Credentials (optional)
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={doctorForm.credentials}
                  onChange={(e) =>
                    setDoctorForm((prev) => ({ ...prev, credentials: e.target.value }))
                  }
                  placeholder="e.g., MD, FPCP"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                PRC No
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={doctorForm.prc_no}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(e) =>
                    setDoctorForm((prev) => ({
                      ...prev,
                      prc_no: sanitizePrcNo(e.target.value),
                    }))
                  }
                  placeholder="Numbers only"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={doctorForm.is_active}
                  onChange={(e) =>
                    setDoctorForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                Active
              </label>

              {doctorFormError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {doctorFormError}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-sm text-gray-700"
                  onClick={() => setDoctorModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={doctorSaving}
                >
                  {doctorSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {affiliationsModalOpen && affiliationsDoctor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Affiliations</h3>
                <p className="text-xs text-gray-500">{affiliationsDoctor.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setAffiliationsModalOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-gray-600">
                  Affiliations for {affiliationsDoctor.full_name}
                </div>
                <button
                  type="button"
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                  onClick={() => openAffiliationModal(affiliationsDoctor)}
                >
                  + Add Affiliation
                </button>
              </div>

              {affiliationsDoctor.affiliations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                  No affiliations yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {affiliationsDoctor.affiliations.map((aff) => (
                    <div key={aff.id} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {aff.institution_name}
                          </div>
                          <div className="text-xs text-gray-500">{aff.address_line}</div>
                          {aff.schedule_text && (
                            <div className="text-xs text-gray-500">{aff.schedule_text}</div>
                          )}
                          {aff.contact_numbers && (
                            <div className="text-xs text-gray-500">{aff.contact_numbers}</div>
                          )}
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusBadgeClass(
                            aff.is_active,
                          )}`}
                        >
                          {aff.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-gray-700"
                          onClick={() => openAffiliationModal(affiliationsDoctor, aff)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-300 px-2 py-1 text-rose-600 disabled:opacity-60"
                          disabled={!aff.is_active}
                          onClick={() => deactivateAffiliation(aff)}
                        >
                          Deactivate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {affiliationModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {affiliationForm.id ? "Edit Affiliation" : "Add Affiliation"}
              </h3>
              <button
                type="button"
                onClick={() => setAffiliationModalOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form
              className="space-y-4 px-5 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveAffiliation();
              }}
            >
              <label className="block text-sm font-medium text-gray-700">
                Institution name
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={affiliationForm.institution_name}
                  onChange={(e) =>
                    setAffiliationForm((prev) => ({
                      ...prev,
                      institution_name: e.target.value,
                    }))
                  }
                  placeholder="Facility name"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Address line
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={affiliationForm.address_line}
                  onChange={(e) =>
                    setAffiliationForm((prev) => ({
                      ...prev,
                      address_line: e.target.value,
                    }))
                  }
                  placeholder="Address"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Contact numbers
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={affiliationForm.contact_numbers}
                  onChange={(e) =>
                    setAffiliationForm((prev) => ({
                      ...prev,
                      contact_numbers: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Schedule text
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={affiliationForm.schedule_text}
                  onChange={(e) =>
                    setAffiliationForm((prev) => ({
                      ...prev,
                      schedule_text: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Sort order
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  type="number"
                  value={affiliationForm.sort_order}
                  onChange={(e) =>
                    setAffiliationForm((prev) => ({
                      ...prev,
                      sort_order: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={affiliationForm.is_active}
                  onChange={(e) =>
                    setAffiliationForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                Active
              </label>

              {affiliationFormError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {affiliationFormError}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-sm text-gray-700"
                  onClick={() => setAffiliationModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={affiliationSaving}
                >
                  {affiliationSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReferralFormView, { ReferralFormData } from "@/components/ReferralFormView";
import { formatPrcNo } from "@/lib/formatPrcNo";

type Specialty = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

type Affiliation = {
  id: string;
  referral_doctor_id: string;
  institution_name: string;
  address_line: string;
  contact_numbers?: string | null;
  schedule_text?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type Doctor = {
  id: string;
  full_name: string;
  credentials?: string | null;
  prc_no?: string | null;
  specialty_id: string;
  affiliations: Affiliation[];
};

type ReferralListItem = {
  id: string;
  referral_code?: string | null;
  created_at?: string | null;
  referred_to_doctor_name?: string | null;
  referred_to_specialty_name?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(+dt)) return value;
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function formatAffiliationBlock(aff?: Affiliation | null) {
  if (!aff) return "";
  return [aff.institution_name, aff.address_line, aff.contact_numbers, aff.schedule_text]
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .join("\n");
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDoctorLabel(doctor?: Doctor | null) {
  if (!doctor) return "";
  const base = String(doctor.full_name || "").trim();
  if (!base) return "";
  const cred = String(doctor.credentials || "").trim();
  if (cred && !new RegExp(`,\\s*${escapeRegExp(cred)}$`).test(base)) {
    return `${base}, ${cred}`;
  }
  return base;
}

export default function ReferralPanel({
  patientId,
  consultationId,
}: {
  patientId: string;
  consultationId: string | null;
}) {
  const sp = useSearchParams();
  const urlCid = useMemo(() => {
    const c = sp.get("c");
    return c && c.trim() ? c.trim() : null;
  }, [sp]);

  const [resolvedConsultationId, setResolvedConsultationId] = useState<string | null>(
    urlCid || consultationId || null,
  );
  const [referrals, setReferrals] = useState<ReferralListItem[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [referralErr, setReferralErr] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtyId, setSpecialtyId] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [affiliationIds, setAffiliationIds] = useState<string[]>([]);
  const [allAffiliationsSelected, setAllAffiliationsSelected] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeLabs, setIncludeLabs] = useState(true);
  const [includeVitals, setIncludeVitals] = useState(true);
  const [includePatientHistory, setIncludePatientHistory] = useState(false);
  const [remarks, setRemarks] = useState("");

  const [busy, setBusy] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [generated, setGenerated] = useState<ReferralFormData | null>(null);

  const selectedDoctor = useMemo(
    () => doctors.find((doc) => doc.id === doctorId) || null,
    [doctors, doctorId],
  );
  const doctorAffiliations = selectedDoctor?.affiliations ?? [];
  const doctorAffiliationIds = doctorAffiliations.map((aff) => aff.id);
  const selectedAffiliationIds = affiliationIds.filter((id) => doctorAffiliationIds.includes(id));
  const finalAffiliationIds = allAffiliationsSelected
    ? doctorAffiliationIds
    : selectedAffiliationIds;
  const selectedAffiliationCount = finalAffiliationIds.length;
  const totalAffiliationCount = doctorAffiliationIds.length;

  function toggleAffiliation(id: string, checked: boolean) {
    setAllAffiliationsSelected(false);
    setAffiliationIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return Array.from(next);
    });
  }

  function toggleAllAffiliations() {
    setAllAffiliationsSelected(true);
    setAffiliationIds([]);
  }

  useEffect(() => {
    setResolvedConsultationId(urlCid || consultationId || null);
  }, [urlCid, consultationId]);

  async function loadReferrals() {
    setLoadingReferrals(true);
    setReferralErr(null);
    try {
      const res = await fetch(
        `/api/referrals/list?patient_id=${encodeURIComponent(patientId)}&limit=5`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load referrals");
      setReferrals((json.referrals || []) as ReferralListItem[]);
    } catch (e: any) {
      setReferralErr(e?.message || "Failed to load referrals");
    } finally {
      setLoadingReferrals(false);
    }
  }

  async function loadSpecialties() {
    setModalErr(null);
    try {
      const res = await fetch("/api/referrals/specialties", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load specialties");
      setSpecialties((json.specialties || []) as Specialty[]);
    } catch (e: any) {
      setModalErr(e?.message || "Failed to load specialties");
    }
  }

  async function loadDoctors(nextSpecialtyId: string) {
    setModalErr(null);
    setDoctors([]);
    if (!nextSpecialtyId) return;
    try {
      const res = await fetch(
        `/api/referrals/doctors?specialty_id=${encodeURIComponent(nextSpecialtyId)}`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load doctors");
      setDoctors((json.doctors || []) as Doctor[]);
    } catch (e: any) {
      setModalErr(e?.message || "Failed to load doctors");
    }
  }

  useEffect(() => {
    loadReferrals();
  }, [patientId]);

  useEffect(() => {
    if (!modalOpen) return;
    if (!specialties.length) {
      loadSpecialties();
    }
  }, [modalOpen, specialties.length]);

  useEffect(() => {
    setDoctorId("");
    setAffiliationIds([]);
    setAllAffiliationsSelected(false);
    if (!specialtyId) {
      setDoctors([]);
      return;
    }
    loadDoctors(specialtyId);
  }, [specialtyId]);

  useEffect(() => {
    if (!selectedDoctor) {
      setAffiliationIds([]);
      setAllAffiliationsSelected(false);
      return;
    }
    setAffiliationIds([]);
    setAllAffiliationsSelected(selectedDoctor.affiliations.length > 0);
  }, [selectedDoctor]);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  function resetModal() {
    setSpecialtyId("");
    setDoctors([]);
    setDoctorId("");
    setAffiliationIds([]);
    setAllAffiliationsSelected(false);
    setIncludeNotes(true);
    setIncludeLabs(true);
    setIncludeVitals(true);
    setIncludePatientHistory(false);
    setRemarks("");
    setGenerated(null);
    setModalErr(null);
  }

  async function onGenerate() {
    setModalErr(null);
    if (!specialtyId) {
      setModalErr("Select a specialty.");
      return;
    }
    if (!doctorId) {
      setModalErr("Select a specialist doctor.");
      return;
    }

    if (doctorAffiliationIds.length > 0 && finalAffiliationIds.length === 0) {
      setModalErr("Select at least one affiliation.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        patient_id: patientId,
        consult_id: resolvedConsultationId,
        referred_to_specialty_id: specialtyId,
        referred_to_doctor_id: doctorId,
        affiliation_ids: finalAffiliationIds,
        include_latest_notes: includeNotes,
        include_latest_labs: includeLabs,
        include_latest_vitals: includeVitals,
        include_patient_history: includePatientHistory,
        notes: remarks,
      };

      const res = await fetch("/api/referrals/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to generate referral");

      setGenerated(json.referral as ReferralFormData);

      await loadReferrals();
      if (resolvedConsultationId) {
        window.dispatchEvent(
          new CustomEvent("referral:generated", {
            detail: { consultationId: resolvedConsultationId, patientId },
          }),
        );
      }
    } catch (e: any) {
      setModalErr(e?.message || "Failed to generate referral");
    } finally {
      setBusy(false);
    }
  }

  function onCopyCode() {
    if (!generated?.referral?.referral_code) return;
    const code = generated.referral.referral_code;
    navigator.clipboard.writeText(code).catch(() => {
      setModalErr("Unable to copy referral code.");
    });
  }

  function openPrint() {
    if (!generated?.referral?.id) return;
    const url = `/doctor/referrals/${generated.referral.id}/print`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Referrals</h3>
        <button
          type="button"
          onClick={() => {
            resetModal();
            setModalOpen(true);
          }}
          className="rounded border border-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent hover:bg-accent/10"
        >
          Generate referral form
        </button>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Recent referrals
        </div>
        {loadingReferrals ? (
          <div className="text-sm text-gray-500">Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <div className="text-sm text-gray-500">No referrals generated yet.</div>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref) => (
              <div key={ref.id} className="rounded border border-gray-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-gray-800">
                    {ref.referred_to_doctor_name || "Specialist"}
                    {ref.referred_to_specialty_name
                      ? ` - ${ref.referred_to_specialty_name}`
                      : ""}
                  </div>
                  <a
                    href={`/doctor/referrals/${ref.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#2e6468] hover:underline"
                  >
                    View
                  </a>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatDate(ref.created_at)} - {ref.referral_code || ref.id}
                </div>
              </div>
            ))}
          </div>
        )}
        {referralErr && <div className="text-xs text-red-600 mt-2">{referralErr}</div>}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 py-6 sm:items-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-[1080px] max-h-[85vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Generate Referral</h2>
                  <p className="text-sm text-gray-500">
                    Select a specialty and specialist, then choose what to include in the form.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Specialty
                    </label>
                    <select
                      value={specialtyId}
                      onChange={(e) => setSpecialtyId(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select specialty...</option>
                      {specialties.map((spec) => (
                        <option key={spec.id} value={spec.id}>
                          {spec.name} ({spec.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Specialist
                    </label>
                    {!specialtyId ? (
                      <div className="text-xs text-gray-500">Select a specialty first.</div>
                    ) : doctors.length === 0 ? (
                      <div className="text-xs text-gray-500">No specialists available.</div>
                    ) : (
                      <div className="space-y-2">
                        {doctors.map((doc) => {
                          const prcNo = formatPrcNo(doc.prc_no);
                          return (
                            <label
                              key={doc.id}
                              className="flex items-start gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
                            >
                              <input
                                type="radio"
                                name="referral-doctor"
                                checked={doctorId === doc.id}
                                onChange={() => setDoctorId(doc.id)}
                              />
                              <div>
                                <div className="font-medium text-gray-800">
                                  {formatDoctorLabel(doc)}
                                </div>
                                {prcNo ? (
                                  <div className="text-xs text-gray-500">PRC {prcNo}</div>
                                ) : null}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Affiliation
                    </label>
                    {!selectedDoctor ? (
                      <div className="text-xs text-gray-500">Choose a specialist first.</div>
                    ) : doctorAffiliations.length === 0 ? (
                      <div className="text-xs text-gray-500">No affiliations listed.</div>
                    ) : (
                      <div className="space-y-2">
                        <label className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                          <input
                            type="radio"
                            name="referral-affiliation-mode"
                            checked={allAffiliationsSelected}
                            onChange={toggleAllAffiliations}
                          />
                          <div>
                            <div className="font-medium text-gray-800">All affiliations</div>
                            <div className="text-xs text-gray-500">
                              Include every listed affiliation for this doctor.
                            </div>
                          </div>
                        </label>
                        <div className="flex items-center justify-between px-1 text-xs text-gray-500">
                          Selected: {selectedAffiliationCount} of {totalAffiliationCount}
                        </div>
                        {doctorAffiliations.map((aff) => (
                          <label
                            key={aff.id}
                            className="flex items-start gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAffiliationIds.includes(aff.id)}
                              onChange={(e) => toggleAffiliation(aff.id, e.target.checked)}
                            />
                            <div>
                              <div className="font-medium text-gray-800">
                                {aff.institution_name}
                              </div>
                              <div className="text-xs text-gray-500 whitespace-pre-line">
                                {formatAffiliationBlock(aff)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Include in referral form
                    </label>
                    <div className="space-y-2 text-sm">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={includeNotes}
                          onChange={(e) => setIncludeNotes(e.target.checked)}
                        />
                        <span>
                          Latest consult notes
                          <div className="text-xs text-gray-500">
                            Latest notes are available only after a consult is marked Done (Sign Rx or
                            Finish w/o Rx).
                          </div>
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={includeLabs}
                          onChange={(e) => setIncludeLabs(e.target.checked)}
                        />
                        <span>Latest labs</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={includeVitals}
                          onChange={(e) => setIncludeVitals(e.target.checked)}
                        />
                        <span>Latest vitals snapshot</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={includePatientHistory}
                          onChange={(e) => setIncludePatientHistory(e.target.checked)}
                        />
                        <span>Patient history</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Referral justification / remarks
                    </label>
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Optional remarks for the specialist"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 overflow-y-auto">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Referral preview
                  </div>
                  {!generated ? (
                    <div className="text-sm text-gray-500">
                      Generate the form to preview the printable referral.
                    </div>
                  ) : (
                    <ReferralFormView data={generated} />
                  )}
                </div>
              </div>

              {generated && (
                <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Referral generated:{" "}
                  <b>{generated.referral.referral_code || generated.referral.id}</b> -{" "}
                  {formatDate(generated.referral.created_at)}
                </div>
              )}

              {modalErr && <div className="text-sm text-red-600 mt-3">{modalErr}</div>}
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                  }}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onGenerate}
                  className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  disabled={busy}
                >
                  {busy ? "Generating..." : "Generate form"}
                </button>
              </div>

              {generated && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openPrint}
                    className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={onCopyCode}
                    className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Copy referral code
                  </button>
                  <a
                    href={`/doctor/referrals/${generated.referral.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Open saved referral
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

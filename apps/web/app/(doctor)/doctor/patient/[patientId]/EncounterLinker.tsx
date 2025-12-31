"use client";

import { useEffect, useMemo, useState } from "react";

type EncounterOption = {
  id: string;
  branch_code?: string | null;
  status?: string | null;
  consult_status?: string | null;
  queue_number?: number | null;
  notes_frontdesk?: string | null;
  visit_date_local?: string | null;
};

export default function EncounterLinker({
  patientId,
  consultationId,
  encounterId,
  onLinked,
}: {
  patientId: string;
  consultationId: string;
  encounterId: string | null;
  onLinked: (encounterId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<EncounterOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const hasOptions = options.length > 0;

  const shortId = (id?: string | null) => {
    if (!id) return "";
    const trimmed = String(id).trim();
    if (trimmed.length <= 6) return trimmed;
    return `…${trimmed.slice(-6)}`;
  };

  const optionLabel = useMemo(() => {
    return (opt: EncounterOption) => {
      const parts = [];
      const date = opt.visit_date_local || "Today";
      parts.push(date);
      const status = opt.consult_status || opt.status;
      if (status) parts.push(status.replace(/_/g, " "));
      parts.push(shortId(opt.id));
      return parts.join(" · ");
    };
  }, []);

  async function loadOptions() {
    if (!consultationId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/doctor/consultations/encounter?patient_id=${encodeURIComponent(patientId)}`,
        { cache: "no-store" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load encounters for today.");
      const list: EncounterOption[] = Array.isArray(j?.encounters) ? j.encounters : [];
      setOptions(list);
      if (!selected && list[0]?.id) setSelected(list[0].id);
    } catch (e: any) {
      setErr(e?.message || "Failed to load encounters for today.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMsg(null);
    setErr(null);
    setSelected(encounterId || "");
    loadOptions();
  }, [consultationId, patientId, encounterId]);

  useEffect(() => {
    if (encounterId) setSelected(encounterId);
  }, [encounterId]);

  async function saveLink(opts: { encounter_id?: string; create_new?: boolean }) {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/doctor/consultations/encounter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          consultation_id: consultationId,
          ...opts,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to link encounter.");
      const encId = j?.encounter_id || opts.encounter_id;
      if (encId) {
        onLinked(String(encId));
        setSelected(String(encId));
        setMsg(j?.created ? "Created and linked a new encounter for today." : "Encounter linked.");
      }
      loadOptions();
    } catch (e: any) {
      setErr(e?.message || "Failed to link encounter.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 bg-slate-50 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Encounter</p>
          <p className="text-xs text-gray-600">
            Link this consultation to a same-day encounter (Asia/Manila) to unlock certificates and
            finishing.
          </p>
        </div>
        {encounterId ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
            Linked
          </span>
        ) : null}
      </div>

      {!encounterId && !msg && (
        <div className="text-xs text-red-600">This consultation is not linked to an encounter.</div>
      )}

      <div className="flex flex-col gap-2">
        <select
          className="w-full rounded border px-2 py-1 text-sm disabled:bg-gray-100"
          value={selected}
          disabled={loading || saving || !hasOptions}
          onChange={(e) => setSelected(e.target.value)}
        >
          {!hasOptions && <option value="">No encounters found for today</option>}
          {hasOptions &&
            options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {optionLabel(opt)}
              </option>
            ))}
        </select>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <button
            type="button"
            onClick={() => saveLink({ encounter_id: selected, create_new: false })}
            disabled={saving || loading || !selected}
            className="rounded bg-[#2e6468] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 w-full sm:w-auto"
          >
            {saving ? "Linking…" : "Link encounter"}
          </button>
          <button
            type="button"
            onClick={() => saveLink({ create_new: true })}
            disabled={saving || loading}
            className="rounded border border-dashed border-gray-400 px-3 py-1.5 text-sm text-gray-700 hover:bg-white disabled:opacity-50 w-full sm:w-auto"
          >
            + Create a new encounter
          </button>
        </div>
      </div>

      {loading && <div className="text-xs text-gray-500">Loading today&apos;s encounters…</div>}
      {msg && <div className="text-xs text-emerald-700">{msg}</div>}
      {err && <div className="text-xs text-red-600">{err}</div>}
    </div>
  );
}

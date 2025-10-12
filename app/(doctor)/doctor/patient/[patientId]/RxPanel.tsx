"use client";

import { useEffect, useMemo, useState } from "react";

type Med = {
  id: string;
  generic_name: string | null;
  strength: string | null;
  form: string | null;
  price: number | null;
};

type Line = {
  med_id?: string | null;
  generic_name?: string;
  strength?: string;
  form?: string;
  brand_name?: string;        // optional, persisted in prescription_items.brand_name
  route?: string;
  dose_amount?: number;
  dose_unit?: string;
  frequency_code?: string;
  duration_days?: number;
  quantity?: number;
  instructions?: string;
  unit_price?: number | null;
};

const ROUTES = ["PO", "IM", "IV", "SC", "Topical", "Inhale"];
const UNITS = ["tab", "cap", "mL", "puff"];
const FREQS = ["OD", "BID", "TID", "QID", "HS", "PRN"];
const FREQ_PER_DAY: Record<string, number> = {
  OD: 1, QD: 1, QAM: 1, QPM: 1,
  BID: 2, TID: 3, QID: 4, HS: 1, PRN: 0,
};

export default function RxPanel({
  patientId,
  consultationId: cidProp,
}: {
  patientId: string;
  consultationId?: string | null;
}) {
  // --- state ---
  const [consultationId, setConsultationId] = useState<string | null>(cidProp ?? null);
  const [notesForPatient, setNotesForPatient] = useState("");
  const [items, setItems] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Med[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [lockedSigned, setLockedSigned] = useState(false);
  const [reviseBusy, setReviseBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  

  // new state for revision/sign flow
  const [rxId, setRxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Enhanced sign control logic
  const canSign =
    Boolean(rxId) &&
    !lockedSigned &&
    !isDirty &&
    saving !== "saving" &&
    !signing; // remove if you don't have `signing` state

  const signTitle =
    !rxId
      ? "Create or load a draft before signing."
      : lockedSigned
      ? "Already signed — create a revision to make changes."
      : isDirty
      ? "Save the draft first, then sign."
      : saving === "saving"
      ? "Saving draft…"
      : signing
      ? "Signing…"
      : "Sign this prescription";


  // If parent provides a consultation id
  useEffect(() => {
    if (cidProp != null) setConsultationId(cidProp);
  }, [cidProp]);

  // Helper: load current draft; if none, hydrate with active signed (read-only)
  async function loadCurrentDraft() {
    if (!consultationId) return;

    // Try draft first
    const res = await fetch(`/api/prescriptions/draft?consultation_id=${encodeURIComponent(consultationId)}`);
    const j = await res.json().catch(() => ({}));

    if (res.ok && j?.id) {
      // ✅ Draft exists — unlock & bind
      setLockedSigned(false);
      setRxId(j.id);
      setItems(Array.isArray(j.items) ? j.items : []);
      setNotesForPatient(j.notes_for_patient ?? "");
      setIsDirty(false);
      return;
    }

    // ❌ No draft — hydrate with active signed (read-only) so banner shows
    const dres = await fetch(`/api/consultations/details?id=${encodeURIComponent(consultationId)}`);
    const dj = await dres.json().catch(() => ({}));
    const rx = dj?.details?.rx || dj?.details?.prescription;

    if (dres.ok && rx?.id && rx?.status === "signed") {
      setLockedSigned(true);     // 🔒 this drives the banner
      setRxId(null);             // no draft selected
      setItems(Array.isArray(rx.items) ? rx.items : []);
      setNotesForPatient(rx.notes_for_patient ?? "");
      setIsDirty(false);
      return;
    }

    // Neither draft nor signed → clean slate (editable)
    setLockedSigned(false);
    setRxId(null);
    setItems([]);
    setNotesForPatient("");
    setIsDirty(false);
  }

  // Load existing Rx whenever consultation changes
  useEffect(() => {
    if (!consultationId) return;
    setError(null);
    loadCurrentDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  // Search meds from pharmacy table
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim()) { setResults([]); return; }
      const res = await fetch(`/api/meds/search?q=${encodeURIComponent(search.trim())}`);
      const json = await res.json();
      if (res.ok) setResults(json.items || []);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Add from pharmacy — prevent duplicates (generic+strength+form)
  function addMed(m: Med) {
    const exists = items.some(
      it =>
        it.generic_name?.toLowerCase() === (m.generic_name ?? "").toLowerCase() &&
        it.strength === m.strength &&
        it.form === m.form
    );
    if (exists) { alert("This medication is already in the list."); return; }
    setItems(prev => [
      ...prev,
      {
        med_id: m.id,
        generic_name: m.generic_name ?? "",
        strength: m.strength ?? "",
        form: m.form ?? "",
        brand_name: "",
        route: "PO",
        dose_amount: 1,
        dose_unit: "tab",
        frequency_code: "BID",
        duration_days: 7,
        quantity: 14,
        instructions: "",
        unit_price: m.price ?? null,
      }
    ]);
    setSearch("");
    setResults([])
    setIsDirty(true);;
  }

  // Add custom (not in DB)
  function addFreeMed() {
    if (!search.trim()) return;
    const parts = search.trim().split(","); // "Amlodipine, 10 mg, tablet"
    const generic = (parts[0] || "New Medication").trim();
    const strength = (parts[1] || "").trim();
    const form = (parts[2] || "").trim();
    const exists = items.some(
      it =>
        it.generic_name?.toLowerCase() === generic.toLowerCase() &&
        it.strength === strength &&
        it.form === form
    );
    if (exists) { alert("This medication is already in the list."); return; }
    setItems(prev => [
      ...prev,
      {
        med_id: null,
        generic_name: generic,
        strength,
        form,
        brand_name: "",
        route: "PO",
        dose_amount: 1,
        dose_unit: "tab",
        frequency_code: "BID",
        duration_days: 7,
        quantity: 14,
        instructions: "",
        unit_price: null,
      }
    ]);
    setSearch("");
    setResults([]);
    setIsDirty(true);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setItems(prev => prev.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln)));
    setIsDirty(true);
  }
  function removeLine(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
    setIsDirty(true);
  }

  // Totals
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      if (it.unit_price != null && it.quantity != null) return sum + it.unit_price * it.quantity;
      return sum;
    }, 0);
  }, [items]);

  function calcSuggestedQty(line: Line): number | null {
    const perDose = Number(line.dose_amount ?? 0);
    const perDay = FREQ_PER_DAY[String(line.frequency_code || "").toUpperCase()] ?? 0;
    const days = Number(line.duration_days ?? 0);
    if (!isFinite(perDose) || !isFinite(perDay) || !isFinite(days)) return null;
    if (perDose <= 0 || perDay <= 0 || days <= 0) return null;
    return Math.max(0, Math.round(perDose * perDay * days));
  }

  // Create a draft revision from the active signed Rx, switch UI to it, and return its id
  async function startRevision(): Promise<string | null> {
    if (reviseBusy) return null;
    if (!consultationId) return null; // ✅ satisfies TS for encodeURIComponent below
    setReviseBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/prescriptions/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.id) {
        setError(j?.error || "Failed to create a revision.");
        return null;
      }

      // ✅ New draft created
      setLockedSigned(false); // unlock editing
      setRxId(j.id);

      // ✅ Hydrate immediately if the server included items and notes
      if (Array.isArray(j.items)) {
        setItems(j.items);
        setNotesForPatient(j.notes_for_patient ?? "");
        setIsDirty(false);
      } else {
        // Otherwise, fall back to fetching the draft endpoint
        const dr = await fetch(
          `/api/prescriptions/draft?consultation_id=${encodeURIComponent(consultationId)}`
        );
        const dj = await dr.json().catch(() => ({}));
        if (dr.ok && dj?.id) {
          setItems(Array.isArray(dj.items) ? dj.items : []);
          setNotesForPatient(dj.notes_for_patient ?? "");
        } else {
          await loadCurrentDraft();
        }
      }

      // tiny UX ping
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1000);

      return j.id; // ✅ return the new draft id
    } finally {
      setReviseBusy(false);
    }
  }

  // Save / delete / sign
  async function saveDraft(opts?: { silent?: boolean }) {
    const silent = opts?.silent ?? false;

    // 🔒 If we're on a signed Rx, ask first
    if (lockedSigned) {
      const proceed = window.confirm(
        "A signed prescription already exists for today. Create a revision?"
      );
      if (!proceed) return;

      // ✅ Create revision and switch to new draft
      const newId = await startRevision();     // ← uses the improved function
      if (!newId) return;

      // 👇 then reattempt save silently on the new draft
      await saveDraft({ silent: true });
      return;
    }

    // 🚀 Proceed with normal draft saving
    if (!consultationId || !patientId) return;

    setError(null);
    setSaving("saving");

    const res = await fetch("/api/prescriptions/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consultationId,
        patientId,
        notesForPatient,
        items, // includes brand_name etc.
      }),
    });

    const j = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSaving("idle");
      if (!silent) alert(j?.error || "Failed to save draft");
      return;
    }

    setRxId(j.id || null);
    setSaving(silent ? "idle" : "saved");
    if (!silent) setTimeout(() => setSaving("idle"), 1200);
    setIsDirty(false);
  }

  async function deleteDraft() {
    if (!consultationId) return;
    if (!confirm("Delete this draft?")) return;

    const res = await fetch("/api/prescriptions/draft", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultationId }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.error || "Failed to delete draft.");
      return;
    }

    // Reset and reflect the lock state (if a signed Rx exists, banner will return)
    setItems([]);
    setNotesForPatient("");
    setRxId(null);
    await loadCurrentDraft();
    setIsDirty(false);
  }


  async function signRx() {
    if (signing) return; // prevent double-clicks
    setSigning(true);
    try {
      setError(null);

      // If the panel is locked to a signed prescription, start a revision first
      if (lockedSigned) {
        await startRevision();
      }

      // Ensure a draft exists before signing
      if (!rxId) {
        await saveDraft({ silent: true });
      }
      if (!rxId) {
        setError("Unable to prepare the prescription for signing.");
        return;
      }

      const res = await fetch("/api/prescriptions/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescriptionId: rxId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || "Failed to sign prescription");
        return;
      }

      // ✅ Lock the panel (now a signed Rx)
      setLockedSigned(true);
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1200);

      // Reset context and reload — /draft will 404, banner remains locked
      setRxId(null);
      await loadCurrentDraft();

      // ✅ Broadcast event so PastConsultations updates immediately
      window.dispatchEvent(
        new CustomEvent("rx:signed", { detail: { consultationId } })
      );
    } finally {
      setSigning(false);
    }
  }


  return (
  <div className="space-y-4">
    {error && <div className="text-sm text-red-600">{error}</div>}

    <div className="flex items-center gap-2">
      <span className="ml-auto text-xs text-gray-500">
        {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : null}
      </span>
    </div>

    {/* Banner when viewing a signed Rx (no draft yet) */}
    {lockedSigned && (
      <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Prescription already <b>signed</b> for this consultation. To make changes,
        create a <b>Revision</b>.
        <button
          type="button"
          onClick={startRevision}
          disabled={reviseBusy}
          className="ml-3 inline-flex items-center rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          Create Revision
        </button>
      </div>
    )}

    {/* Everything below becomes read-only when lockedSigned = true */}
    <fieldset
      disabled={lockedSigned}
      className={lockedSigned ? "opacity-60 pointer-events-none" : ""}
    >
      {/* Search + results */}
      <div>
        <label className="block text-sm mb-1">
          Add medicine from pharmacy list. If preferred medication is not available:
          input [Generic Name, strength, form] → "Add Custom"
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2"
            placeholder="Search meds… (generic, strength, form)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="px-3 py-2 border rounded text-sm"
            onClick={() => addFreeMed()}
          >
            Add Custom
          </button>
        </div>
        {!!results.length && (
          <div className="border rounded-lg mt-2 max-h-48 overflow-auto">
            {results.map((m) => (
              <button
                type="button"
                key={m.id}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                onClick={() => addMed(m)}
              >
                <div className="text-sm">
                  <b>{m.generic_name}</b> — {m.strength} {m.form}
                  {m.price != null && (
                    <span className="text-gray-500"> · ₱{m.price}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="space-y-3">
        {items.map((ln, i) => (
          <div key={i} className="border rounded-xl p-3">
            {/* Header */}
            <div className="flex items-center gap-2 text-sm">
              <div className="font-medium">
                {ln.generic_name} — {ln.strength} {ln.form}
                {ln.brand_name && (
                  <span className="text-gray-500"> ({ln.brand_name})</span>
                )}
                {ln.unit_price != null && (
                  <span className="text-gray-500"> · Unit ₱{ln.unit_price}</span>
                )}
              </div>
              <button
                className="ml-auto text-xs text-red-600 underline"
                onClick={() => removeLine(i)}
                type="button"
              >
                Remove
              </button>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-sm">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Brand (optional)
                </label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={ln.brand_name || ""}
                  onChange={(e) => updateLine(i, { brand_name: e.target.value })}
                  placeholder="e.g., Norvasc"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Route</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={ln.route || "PO"}
                  onChange={(e) => updateLine(i, { route: e.target.value })}
                >
                  {ROUTES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Dose amount
                </label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  step="0.5"
                  value={ln.dose_amount ?? 1}
                  onChange={(e) =>
                    updateLine(i, { dose_amount: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Dose unit
                </label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={ln.dose_unit || "tab"}
                  onChange={(e) => updateLine(i, { dose_unit: e.target.value })}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Frequency
                </label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={ln.frequency_code || "BID"}
                  onChange={(e) =>
                    updateLine(i, { frequency_code: e.target.value })
                  }
                >
                  {FREQS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-1 mt-1">
                  {["OD", "BID", "TID", "QID", "HS", "PRN"].map((code) => (
                    <button
                      key={code}
                      type="button"
                      className="text-[11px] px-2 py-1 rounded border"
                      onClick={() => updateLine(i, { frequency_code: code })}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Duration (days)
                </label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  min={1}
                  value={ln.duration_days ?? 7}
                  onChange={(e) =>
                    updateLine(i, { duration_days: Number(e.target.value) })
                  }
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {[3, 5, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="text-[11px] px-2 py-1 rounded border"
                      onClick={() => updateLine(i, { duration_days: d })}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Quantity
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="border rounded px-2 py-1 w-28"
                    type="number"
                    min={1}
                    value={ln.quantity ?? 14}
                    onChange={(e) =>
                      updateLine(i, { quantity: Number(e.target.value) })
                    }
                  />
                  <button
                    className="text-xs underline text-gray-700"
                    type="button"
                    onClick={() => {
                      const q = calcSuggestedQty(ln);
                      if (q != null) updateLine(i, { quantity: q });
                    }}
                  >
                    Calc
                  </button>
                </div>
              </div>
            </div>

            {ln.unit_price != null && ln.quantity != null && (
              <div className="text-right text-sm mt-2">
                Line total: ₱{(ln.unit_price * ln.quantity).toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Shared instructions */}
      <div>
        <label className="block text-sm mb-1">Shared instructions for patient</label>
        <textarea
          className="w-full border rounded p-2 text-sm"
          value={notesForPatient}
          onChange={(e) => {
            setNotesForPatient(e.target.value);
            setIsDirty(true);
          }}
          placeholder="Diet, lifestyle, follow-up, special instructions…"
        />
      </div>

      {/* Bottom actions */}
      <div className="sticky bottom-0 bg-white pt-2 pb-2 border-t mt-2">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">
            Subtotal: ₱{subtotal.toFixed(2)}
          </div>
          <button
            className="ml-auto rounded border px-3 py-2"
            type="button"
            onClick={() => saveDraft()}
          >
            Save Draft
          </button>
          <button
            className="rounded border px-3 py-2"
            type="button"
            onClick={() => deleteDraft()}
          >
            Delete Draft
          </button>
          <button
            type="button"
            onClick={signRx}
            className="rounded bg-[#44969b] text-white px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canSign}
            title={signTitle}
            aria-disabled={!canSign}
          >
            Sign Prescription
          </button>
        </div>
      </div>
    </fieldset>
  </div>
);
}

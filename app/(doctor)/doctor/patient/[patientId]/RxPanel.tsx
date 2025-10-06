"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Med = {
  id: string;
  generic_name: string | null;
  strength: string | null;
  form: string | null;
  price: number | null;
};

type Line = {
  med_id?: string;
  generic_name?: string;
  strength?: string;
  form?: string;
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
const FREQS = ["OD", "BID", "TID", "QID", "HS", "PRN"]; // quick options

// Frequency → times/day for the calculator
const FREQ_PER_DAY: Record<string, number> = {
  OD: 1, QD: 1, QAM: 1, QPM: 1,
  BID: 2,
  TID: 3,
  QID: 4,
  HS: 1,
  PRN: 0, // as needed (no auto-calc)
};

export default function RxPanel({
  patientId,
  consultationId: cidProp,
}: {
  patientId: string;
  consultationId?: string | null;
}) {
  const [consultationId, setConsultationId] = useState<string | null>(cidProp ?? null);

  const [notesForPatient, setNotesForPatient] = useState("");
  const [items, setItems] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Med[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);

  // guard so fallback upsert doesn't run twice
  const triedUpsertRef = useRef(false);

  // If parent gives us a consultation ID, use it.
  useEffect(() => {
    if (cidProp != null) setConsultationId(cidProp);
  }, [cidProp]);

  // Fallback (rare): create today's consultation if parent didn't pass one
  useEffect(() => {
    if (cidProp != null) return;
    if (triedUpsertRef.current) return;
    triedUpsertRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/consultations/upsert-today", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId }),
        });
        const json = await res.json();
        if (res.ok && json?.consultation?.id) {
          setConsultationId(json.consultation.id as string);
          setErr(null);
        } else {
          setErr(json?.error || "Failed to create consultation.");
        }
      } catch (e) {
        console.error(e);
        setErr("Network error while creating consultation.");
      }
    })();
  }, [cidProp, patientId]);

  // Med search
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim()) { setResults([]); return; }
      const res = await fetch(`/api/meds/search?q=${encodeURIComponent(search.trim())}`);
      const json = await res.json();
      if (res.ok) setResults(json.items || []);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  function addMed(m: Med) {
    setItems(prev => [
      ...prev,
      {
        med_id: m.id,
        generic_name: m.generic_name ?? "",
        strength: m.strength ?? "",
        form: m.form ?? "",
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
    setResults([]);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setItems(prev => prev.map((ln, idx) => idx === i ? { ...ln, ...patch } : ln));
  }
  function removeLine(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  // Always show prices to doctor/staff
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      if (it.unit_price != null && it.quantity != null) {
        return sum + it.unit_price * it.quantity;
      }
      return sum;
    }, 0);
  }, [items]);

  function calcSuggestedQty(line: Line): number | null {
    const perDose = Number(line.dose_amount ?? 0);
    const perDay  = FREQ_PER_DAY[String(line.frequency_code || "").toUpperCase()] ?? 0;
    const days    = Number(line.duration_days ?? 0);

    if (!isFinite(perDose) || !isFinite(perDay) || !isFinite(days)) return null;
    if (perDose <= 0 || perDay <= 0 || days <= 0) return null;

    // Simple tablet/capsule calculation
    return Math.max(0, Math.round(perDose * perDay * days));
  }

  async function saveDraft() {
    if (!consultationId) { setErr("Consultation not ready."); return; }
    setSaving("saving");
    const payload = {
      consultationId,
      patientId,
      notesForPatient,
      items: items.map((it) => ({
        med_id: it.med_id,
        generic_name: it.generic_name,
        strength: it.strength,
        form: it.form,
        route: it.route,
        dose_amount: it.dose_amount,
        dose_unit: it.dose_unit,
        frequency_code: it.frequency_code,
        duration_days: it.duration_days,
        quantity: it.quantity,
        instructions: it.instructions,
        unit_price: it.unit_price ?? null,
      })),
    };
    const res = await fetch("/api/prescriptions/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(res.ok ? "saved" : "idle");
    if (!res.ok) setErr("Failed to save draft.");
  }

  async function signRx() {
    await saveDraft();
    if (!consultationId) return;
    const res = await fetch("/api/prescriptions/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultationId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error || "Failed to sign prescription.");
      return;
    }
    setErr(null);
    alert("Prescription signed!");
    setItems([]);
  }

  return (
    <div className="space-y-4">
      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="flex items-center gap-2">
        <span className="ml-auto text-xs text-gray-500">
          {saving === "saving" && "Saving…"}
          {saving === "saved" && "Saved"}
        </span>
      </div>

      {/* Search + results */}
      <div>
        <label className="block text-sm mb-1">Add medicine from pharmacy list</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Search meds… (generic, strength, form)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                  {m.price != null && <span className="text-gray-500"> · ₱{m.price}</span>}
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
                {ln.unit_price != null ? (
                  <span className="text-gray-500"> · Unit ₱{ln.unit_price}</span>
                ) : null}
              </div>
              <button
                className="ml-auto text-xs text-red-600 underline"
                onClick={() => removeLine(i)}
                type="button"
              >
                Remove
              </button>
            </div>

            {/* Labeled fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-sm">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Route</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={ln.route || "PO"}
                  onChange={(e)=>updateLine(i,{route:e.target.value})}
                >
                  {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Dose amount</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  step="0.5"
                  value={ln.dose_amount ?? 1}
                  onChange={(e)=>updateLine(i,{dose_amount:Number(e.target.value)})}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Dose unit</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={ln.dose_unit || "tab"}
                  onChange={(e)=>updateLine(i,{dose_unit:e.target.value})}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Frequency</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={ln.frequency_code || "BID"}
                  onChange={(e)=>updateLine(i,{frequency_code:e.target.value})}
                >
                  {FREQS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {/* quick chips */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {["OD","BID","TID","QID","HS","PRN"].map(code => (
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
                <label className="block text-xs text-gray-600 mb-1">Duration (days)</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  min={1}
                  value={ln.duration_days ?? 7}
                  onChange={(e)=>updateLine(i,{duration_days:Number(e.target.value)})}
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {[3,5,7,14,30].map(d => (
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
                <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                <div className="flex items-center gap-2">
                  <input
                    className="border rounded px-2 py-1 w-28"
                    type="number"
                    min={1}
                    value={ln.quantity ?? 14}
                    onChange={(e)=>updateLine(i,{quantity:Number(e.target.value)})}
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

            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">Special instructions</label>
              <textarea
                className="w-full border rounded p-2 text-sm"
                placeholder="e.g., take after meals"
                value={ln.instructions || ""}
                onChange={(e)=>updateLine(i,{instructions:e.target.value})}
              />
            </div>

            {ln.unit_price != null && ln.quantity != null && (
              <div className="text-right text-sm mt-2">
                Line total: ₱{(ln.unit_price * ln.quantity).toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Shared instructions for patient */}
      <div>
        <label className="block text-sm mb-1">Shared instructions for patient</label>
        <textarea
          className="w-full border rounded p-2 text-sm"
          value={notesForPatient}
          onChange={(e)=>setNotesForPatient(e.target.value)}
          placeholder="Diet, lifestyle, follow-up, special instructions…"
        />
      </div>

      {/* Sticky totals + actions */}
      <div className="sticky bottom-0 bg-white pt-2 pb-2 border-t mt-2">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">Subtotal: ₱{subtotal.toFixed(2)}</div>
          <button className="ml-auto rounded border px-3 py-2" type="button" onClick={saveDraft}>
            Save Draft
          </button>
          <button className="rounded bg-[#44969b] text-white px-3 py-2" type="button" onClick={signRx}>
            Sign Prescription
          </button>
        </div>
      </div>
    </div>
  );
}

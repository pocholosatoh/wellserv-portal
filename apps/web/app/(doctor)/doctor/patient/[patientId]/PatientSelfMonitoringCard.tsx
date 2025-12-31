"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const PARAMETERS = [
  { key: "bp", label: "BP" },
  { key: "weight", label: "Weight" },
  { key: "glucose", label: "Blood Glucose (Home Glucometer)" },
] as const;

type ParameterKey = (typeof PARAMETERS)[number]["key"];

type MonitoringItem = {
  enabled: boolean;
  instructions: string;
  frequency: string;
};

function emptyItems(): Record<ParameterKey, MonitoringItem> {
  return {
    bp: { enabled: false, instructions: "", frequency: "" },
    weight: { enabled: false, instructions: "", frequency: "" },
    glucose: { enabled: false, instructions: "", frequency: "" },
  };
}

export default function PatientSelfMonitoringCard({
  patientId,
  initialConsultationId,
}: {
  patientId: string;
  initialConsultationId: string | null;
}) {
  const sp = useSearchParams();
  const urlCid = useMemo(() => {
    const c = sp.get("c");
    return c && c.trim() ? c.trim() : null;
  }, [sp]);

  const [consultationId, setConsultationId] = useState<string | null>(
    urlCid || initialConsultationId || null,
  );

  const [items, setItems] = useState<Record<ParameterKey, MonitoringItem>>(emptyItems);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (urlCid && urlCid !== consultationId) setConsultationId(urlCid);
  }, [urlCid, consultationId]);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/doctor/patient-self-monitoring?patient_id=${encodeURIComponent(patientId)}`,
          { cache: "no-store" },
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);

        const next = emptyItems();
        (j?.monitoring || []).forEach((row: any) => {
          const key = row?.parameter_key as ParameterKey;
          if (!key || !(key in next)) return;
          next[key] = {
            enabled: Boolean(row?.enabled),
            instructions: row?.instructions ?? "",
            frequency: row?.frequency ?? "",
          };
        });
        if (!abort) setItems(next);
      } catch (e: any) {
        if (!abort) setErr(e?.message || "Failed to load");
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [patientId]);

  useEffect(() => {
    if (saving !== "saved") return;
    const t = setTimeout(() => setSaving("idle"), 2000);
    return () => clearTimeout(t);
  }, [saving]);

  function updateItem(key: ParameterKey, patch: Partial<MonitoringItem>) {
    setSaving("idle");
    setErr(null);
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function onSave() {
    if (!consultationId) {
      setErr("Start a consultation to save self-monitoring.");
      return;
    }

    try {
      setSaving("saving");
      setErr(null);

      const payload = {
        patient_id: patientId,
        consultation_id: consultationId,
        items: PARAMETERS.map((p) => ({
          parameter_key: p.key,
          enabled: items[p.key].enabled,
          instructions: items[p.key].instructions,
          frequency: items[p.key].frequency,
        })),
      };

      const res = await fetch("/api/doctor/patient-self-monitoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);

      setSaving("saved");
    } catch (e: any) {
      setErr(e?.message || "Save failed");
      setSaving("idle");
    }
  }

  const disabled = !consultationId || loading || saving === "saving";

  return (
    <div className="space-y-3">
      {!consultationId && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Start a consultation to enable prescribing self-monitoring.
        </div>
      )}
      {loading && <div className="text-sm text-gray-500">Loading monitoring settings...</div>}

      <div className="space-y-3">
        {PARAMETERS.map((p) => {
          const item = items[p.key];
          return (
            <div key={p.key} className="rounded-lg border border-gray-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => updateItem(p.key, { enabled: e.target.checked })}
                  disabled={disabled}
                />
                <span>{p.label}</span>
              </label>

              {item.enabled && (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Instructions</label>
                    <textarea
                      rows={2}
                      value={item.instructions}
                      onChange={(e) => updateItem(p.key, { instructions: e.target.value })}
                      placeholder="e.g., Measure after waking up"
                      className="w-full rounded border px-2 py-1 text-sm"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Frequency</label>
                    <input
                      type="text"
                      value={item.frequency}
                      onChange={(e) => updateItem(p.key, { frequency: e.target.value })}
                      placeholder="e.g., 2x daily"
                      className="w-full rounded border px-2 py-1 text-sm"
                      disabled={disabled}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className="rounded bg-[#44969b] px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving === "saving" ? "Saving..." : "Save Monitoring"}
        </button>
        {saving === "saved" && <span className="text-sm text-emerald-600">Saved</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}

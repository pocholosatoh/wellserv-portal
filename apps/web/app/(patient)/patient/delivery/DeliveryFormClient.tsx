"use client";

import { useState } from "react";

export type DeliveryInfo = {
  patient_id: string;
  full_name: string | null;
  delivery_address_label: string | null;
  delivery_address_text: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  last_delivery_used_at: string | null;
  last_delivery_success_at: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: process.env.APP_TZ || "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return DATE_FMT.format(dt);
}

function toInputValue(n: number | null) {
  return n === null || n === undefined ? "" : String(n);
}

function toNum(value: string) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function successCopy() {
  return "Your delivery request has been received. A WELLSERV representative will call to confirm your order.";
}

function formDefaults(initial: DeliveryInfo | null) {
  return {
    delivery_address_label: initial?.delivery_address_label || "",
    delivery_address_text: initial?.delivery_address_text || "",
    delivery_lat: toInputValue(initial?.delivery_lat ?? null),
    delivery_lng: toInputValue(initial?.delivery_lng ?? null),
    delivery_notes: initial?.delivery_notes || "",
  };
}

function lastRequestedAt(initial: DeliveryInfo | null) {
  if (!initial?.last_delivery_used_at) return null;
  return formatDate(initial.last_delivery_used_at);
}

function lastDeliveredAt(initial: DeliveryInfo | null) {
  if (!initial?.last_delivery_success_at) return null;
  return formatDate(initial.last_delivery_success_at);
}

export function DeliveryFormClient({
  accent,
  initial,
}: {
  accent: string;
  initial: DeliveryInfo | null;
}) {
  const [form, setForm] = useState(() => formDefaults(initial));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestedAt, setRequestedAt] = useState(lastRequestedAt(initial));
  const [deliveredAt, setDeliveredAt] = useState(lastDeliveredAt(initial));
  const [locating, setLocating] = useState(false);

  async function pinLocation() {
    setLocating(true);
    try {
      await new Promise<void>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(
            new Error(
              "Your browser does not support location access. Please enter coordinates manually.",
            ),
          );
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            setForm((f) => ({
              ...f,
              delivery_lat: toInputValue(lat),
              delivery_lng: toInputValue(lng),
            }));
            setError(null);
            resolve();
          },
          (err) => {
            console.error("[delivery] geolocation error", err);
            let msg =
              err?.code === 1
                ? "Location permission was denied. Please allow access and try again."
                : err?.code === 2
                  ? "Position is unavailable. Please check your internet/GPS or type the coordinates manually."
                  : err?.code === 3
                    ? "Location request timed out. Please try again or type the coordinates manually."
                    : "Unable to fetch your location. Please try again or enter coordinates manually.";
            reject(new Error(msg));
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
      });
    } catch (e: any) {
      setError(e?.message || "Unable to fetch your location. Please allow location access.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const payload = {
        delivery_address_label: form.delivery_address_label.trim(),
        delivery_address_text: form.delivery_address_text.trim(),
        delivery_lat: toNum(form.delivery_lat),
        delivery_lng: toNum(form.delivery_lng),
        delivery_notes: form.delivery_notes.trim() || undefined,
      };

      if (!payload.delivery_address_label || !payload.delivery_address_text) {
        throw new Error("Please fill in your address label and full address.");
      }
      if (payload.delivery_lat === null || payload.delivery_lng === null) {
        throw new Error("Please provide valid latitude and longitude.");
      }

      const res = await fetch("/api/patient/delivery-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save delivery request.");

      setSuccess(true);
      setRequestedAt(formatDate(json.patient?.last_delivery_used_at || new Date().toISOString()));
      setDeliveredAt(null);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
          {successCopy()}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Fieldset label="Address label" required>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1"
            placeholder="Home, Office, etc."
            value={form.delivery_address_label}
            onChange={(e) => setForm((f) => ({ ...f, delivery_address_label: e.target.value }))}
          />
          <Description>Short name for this address.</Description>
        </Fieldset>

        <Fieldset label="Latitude / Longitude" required>
          <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
            <div className="grid gap-2 sm:grid-cols-2 sm:col-span-2">
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1"
                type="number"
                step="0.000001"
                placeholder="Lat"
                value={form.delivery_lat}
                onChange={(e) => setForm((f) => ({ ...f, delivery_lat: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1"
                type="number"
                step="0.000001"
                placeholder="Lng"
                value={form.delivery_lng}
                onChange={(e) => setForm((f) => ({ ...f, delivery_lng: e.target.value }))}
              />
            </div>
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-1 sm:w-auto"
              onClick={pinLocation}
              disabled={locating}
            >
              {locating ? "Locating…" : "Pin my location"}
            </button>
          </div>
          <Description>
            Use decimal coordinates (e.g., from Google Maps) or pin your current location.
          </Description>
        </Fieldset>
      </div>

      <Fieldset label="Full address" required>
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1"
          rows={3}
          placeholder="Street, Barangay, City / landmarks"
          value={form.delivery_address_text}
          onChange={(e) => setForm((f) => ({ ...f, delivery_address_text: e.target.value }))}
        />
        <Description>Complete address where the rider should go.</Description>
      </Fieldset>

      <Fieldset label="Notes / landmarks (optional)">
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1"
          rows={3}
          placeholder="Blue gate, beside sari-sari store"
          value={form.delivery_notes}
          onChange={(e) => setForm((f) => ({ ...f, delivery_notes: e.target.value }))}
        />
      </Fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {requestedAt ? `Last requested: ${requestedAt}` : "No delivery request yet."}
          {deliveredAt ? ` • Last delivered: ${deliveredAt}` : ""}
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ backgroundColor: accent, opacity: saving ? 0.8 : 1 }}
          disabled={saving}
        >
          {saving ? "Saving…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}

function Fieldset({
  label,
  children,
  required,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-800">
        {label} {required && <span className="text-rose-500">*</span>}
      </div>
      {children}
    </label>
  );
}

function Description({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

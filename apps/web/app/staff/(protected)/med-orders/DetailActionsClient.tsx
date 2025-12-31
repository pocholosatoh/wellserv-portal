"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtManila } from "@/lib/time";

type PatientSummary = {
  patient_id: string;
  full_name: string | null;
  contact_no: string | null;
  googleMapsUrl: string | null;
  delivery_address_text: string | null;
  delivery_notes: string | null;
  last_delivery_success_at: string | null;
};

export function DetailActionsClient({
  accent,
  patient,
}: {
  accent: string;
  patient: PatientSummary;
}) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deliveredAt, setDeliveredAt] = useState<string | null>(patient.last_delivery_success_at);

  async function share() {
    const text = [
      "MEDS DELIVERY - WELLSERV",
      "",
      `Patient: ${patient.full_name || ""} (${patient.patient_id})`,
      `Contact: ${patient.contact_no || "N/A"}`,
      `Address: ${patient.delivery_address_text || "N/A"}`,
      `Notes: ${patient.delivery_notes || "None"}`,
      patient.googleMapsUrl ? `Maps: ${patient.googleMapsUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ text });
        setToast("Shared.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setToast("Details copied. Paste into Messenger.");
      } else {
        setToast("Sharing not supported on this device.");
      }
    } catch (e: any) {
      setToast(e?.message || "Failed to share.");
    }
  }

  async function markDelivered() {
    setMarking(true);
    setToast(null);
    try {
      const res = await fetch("/api/staff/med-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patient.patient_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update delivery status");
      setDeliveredAt(json.last_delivery_success_at || null);
      setToast("Marked as delivered.");
      router.refresh();
    } catch (e: any) {
      setToast(e?.message || "Failed to update delivery status.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/70 bg-white/95 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Actions</h3>
        {deliveredAt && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
            Delivered {fmtManila(deliveredAt)}
          </span>
        )}
      </div>
      {toast && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {toast}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={share}
        >
          Share Delivery Details
        </button>
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ backgroundColor: accent, opacity: marking ? 0.85 : 1 }}
          disabled={marking}
          onClick={markDelivered}
        >
          {marking ? "Updating…" : "Mark as Delivered"}
        </button>
      </div>
    </div>
  );
}

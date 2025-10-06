// app/(staff)/prescriptions/page.tsx
"use client";

import { useState } from "react";
import { fmtManila } from "@/lib/time";

type Rx = any;

export default function StaffPrescriptionsPage() {
  const [patientId, setPatientId] = useState("");
  const [list, setList] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setErr(null);
    try {
      const url = `/api/staff/prescriptions?patient_id=${encodeURIComponent(
        patientId.trim()
      )}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setList(json.prescriptions || []);
    } catch (e: any) {
      setErr(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function saveDiscount(rxId: string, form: HTMLFormElement) {
    const fd = new FormData(form);
    const discountType = (fd.get("discountType") as string) || null;
    const discountValue = fd.get("discountValue")
      ? Number(fd.get("discountValue"))
      : null;
    const discountExpiresAt = (fd.get("discountExpiresAt") as string) || null;
    const discountAppliedBy = (fd.get("discountAppliedBy") as string) || null;

    const res = await fetch("/api/prescriptions/discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prescriptionId: rxId,
        discountType,
        discountValue,
        discountExpiresAt,
        discountAppliedBy,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to save discount");
      return;
    }
    await search(); // refresh
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Staff — Prescriptions</h1>
      <p className="text-xs text-gray-600 mb-4">
        Prices and totals here are for staff use only. Patient printouts never show prices.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="Patient ID…"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        />
        <button
          className="rounded bg-[#44969b] text-white px-4 py-2"
          onClick={search}
          disabled={loading}
        >
          {loading ? "Loading…" : "Search"}
        </button>
      </div>

      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}

      {!list.length ? (
        <p className="text-sm text-gray-600">No signed prescriptions found.</p>
      ) : (
        <div className="space-y-6">
          {list.map((r) => {
            // totals per prescription
            const rows = r.items || [];
            const subtotal = rows.reduce((sum: number, it: any) => {
              const p = Number(it.unit_price ?? 0);
              const q = Number(it.quantity ?? 0);
              return sum + (isFinite(p) && isFinite(q) ? p * q : 0);
            }, 0);

            const now = new Date();
            const isActive = r.discount_expires_at
              ? new Date(r.discount_expires_at) > now
              : false;

            let discount = 0;
            if (r.discount_type && r.discount_value != null && isActive) {
              if (r.discount_type === "percent") {
                discount = subtotal * (Number(r.discount_value) / 100);
              } else if (r.discount_type === "amount") {
                discount = Number(r.discount_value);
              }
              if (!isFinite(discount)) discount = 0;
              if (discount > subtotal) discount = subtotal;
            }
            const total = Math.max(0, subtotal - discount);

            return (
              <div key={r.id} className="border rounded-xl bg-white/95 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Prescription</div>
                  <div className="text-xs text-gray-500">
                    {fmtManila(r.created_at)}
                  </div>
                </div>

                <div className="mt-2 text-sm">
                  <div>
                    <b>Patient:</b> {r.patient_id}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Items</div>
                  <ul className="text-sm list-disc pl-6">
                    {rows.map((ln: any) => (
                      <li key={ln.id}>
                        <span className="font-medium">{ln.generic_name}</span>{" "}
                        — {ln.strength} {ln.form} · {ln.route || "PO"} ·{" "}
                        {ln.dose_amount} {ln.dose_unit} {ln.frequency_code} ·{" "}
                        {ln.duration_days} days · Qty {ln.quantity}
                        {ln.instructions ? ` — ${ln.instructions}` : ""}
                        {ln.unit_price != null && ln.quantity != null ? (
                          <> — ₱{(ln.unit_price * ln.quantity).toFixed(2)}</>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Totals */}
                <div className="mt-2 text-sm">
                  <div>Subtotal: ₱{subtotal.toFixed(2)}</div>
                  {r.discount_type && r.discount_value != null && (
                    <div>
                      Discount: −₱{discount.toFixed(2)}{" "}
                      {isActive ? "" : "(expired)"}
                      {r.discount_type === "percent"
                        ? ` (${r.discount_value}%)`
                        : ""}
                    </div>
                  )}
                  <div className="font-medium">Total: ₱{total.toFixed(2)}</div>
                </div>

                {/* Print link */}
                <div className="mt-2 text-right">
                  <a
                    className="text-xs underline text-gray-700"
                    href={`/prescription/${r.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Print
                  </a>
                </div>

                {/* Discount editor */}
                <form
                  className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveDiscount(r.id, e.currentTarget);
                  }}
                >
                  <div>
                    <label className="block text-xs text-gray-600">
                      Discount Type
                    </label>
                    <select
                      name="discountType"
                      className="w-full border rounded px-2 py-1"
                      defaultValue={r.discount_type || ""}
                    >
                      <option value="">None</option>
                      <option value="percent">Percent (%)</option>
                      <option value="amount">Amount (₱)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">Value</label>
                    <input
                      name="discountValue"
                      className="w-full border rounded px-2 py-1"
                      type="number"
                      step="0.01"
                      defaultValue={r.discount_value ?? ""}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">
                      Expires At
                    </label>
                    <input
                      name="discountExpiresAt"
                      className="w-full border rounded px-2 py-1"
                      type="datetime-local"
                      defaultValue={
                        r.discount_expires_at
                          ? new Date(r.discount_expires_at)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">
                      Applied By (staff)
                    </label>
                    <input
                      name="discountAppliedBy"
                      className="w-full border rounded px-2 py-1"
                      placeholder="Initials/Name"
                      defaultValue={r.discount_applied_by || ""}
                    />
                  </div>
                  <div>
                    <button className="w-full rounded bg-[#44969b] text-white px-3 py-2">
                      Save
                    </button>
                  </div>
                  {r.discount_expires_at && (
                    <div className="md:col-span-5 text-xs text-gray-500">
                      Current status: {isActive ? "Active" : "Expired"} · Expires:{" "}
                      {fmtManila(r.discount_expires_at)}
                    </div>
                  )}
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

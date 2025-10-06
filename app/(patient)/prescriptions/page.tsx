// app/(patient)/prescriptions/page.tsx  (or app/p/prescriptions/page.tsx)
"use client";

import { useEffect, useState } from "react";
import { fmtManila } from "@/lib/time";

type Rx = any;

export default function PatientPrescriptionsPage() {
  const [list, setList] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Patient-side local toggle (does NOT hit DB)
  const [showPrices, setShowPrices] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        // If you’re testing without login, you can forward location.search temporarily
        const res = await fetch(`/api/patient/prescriptions`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed");
        setList(json.prescriptions || []);
      } catch (e: any) {
        setErr(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Prescriptions</h1>

      {/* Patient-only toggle */}
      <label className="text-sm text-gray-700 inline-flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={showPrices}
          onChange={() => setShowPrices((v) => !v)}
        />
        Show prices on this page (not shown on printed Rx)
      </label>

      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : !list.length ? (
        <p className="text-sm text-gray-600">No prescriptions yet.</p>
      ) : (
        <div className="space-y-6">
          {list.map((r) => {
            const rows = r.items || [];

            // Compute totals from saved unit_price — ONLY if patient toggles on
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
            if (showPrices && isActive && r.discount_type && r.discount_value != null) {
              if (r.discount_type === "percent") {
                discount = subtotal * (Number(r.discount_value) / 100);
              } else if (r.discount_type === "amount") {
                discount = Number(r.discount_value);
              }
              if (!isFinite(discount)) discount = 0;
              if (discount > subtotal) discount = subtotal;
            }
            const total = showPrices ? Math.max(0, subtotal - discount) : null;

            return (
              <div key={r.id} className="border rounded-xl bg-white/95 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Prescription</div>
                  <div className="text-xs text-gray-500">{fmtManila(r.created_at)}</div>
                </div>

                {r.notes_for_patient && (
                  <div className="mt-2 text-sm">
                    <b>Instructions:</b> {r.notes_for_patient}
                  </div>
                )}

                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Items</div>
                  <ul className="text-sm list-disc pl-6">
                    {rows.map((ln: any) => (
                      <li key={ln.id}>
                        <span className="font-medium">{ln.generic_name}</span>{" "}
                        — {ln.strength} {ln.form} · {ln.route || "PO"} · {ln.dose_amount}{" "}
                        {ln.dose_unit} {ln.frequency_code} · {ln.duration_days} days · Qty{" "}
                        {ln.quantity}
                        {ln.instructions ? ` — ${ln.instructions}` : ""}
                        {showPrices && ln.unit_price != null && ln.quantity != null ? (
                          <> — ₱{(ln.unit_price * ln.quantity).toFixed(2)}</>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>

                {showPrices && (
                  <div className="mt-3 text-sm">
                    <div>Subtotal: ₱{subtotal.toFixed(2)}</div>
                    {discount ? (
                      <div>
                        Discount: −₱{discount.toFixed(2)} {isActive ? "" : "(expired)"}
                        {r.discount_type === "percent" ? ` (${r.discount_value}%)` : ""}
                      </div>
                    ) : null}
                    <div className="font-medium">
                      Total: ₱{(total ?? 0).toFixed(2)}
                    </div>
                  </div>
                )}

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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

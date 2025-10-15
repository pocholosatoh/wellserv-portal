// app/(patient)/prescriptions/page.tsx  (or app/p/prescriptions/page.tsx)
"use client";

import { useEffect, useState } from "react";
import { fmtManila } from "@/lib/time";
import { describeFrequency } from "@/lib/rx";

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
    <main className="min-h-dvh">
      {/* Sticky header (page-level, not per Rx) */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-5xl flex items-center justify-between p-3">
          <a href="/patient" className="rounded-lg border px-3 py-2">← Back to Home</a>
          <a
            href="/results"
            className="rounded-lg px-3 py-2 text-white"
            style={{ backgroundColor: (process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b") }}
          >
            View Results
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Prescriptions</h1>
          {/* Patient-only toggle */}
          <label className="text-sm text-gray-700 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPrices}
              onChange={() => setShowPrices((v) => !v)}
            />
            Show prices on this page (not shown on printed Rx)
          </label>
        </header>

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
                <div key={r.id} className="rounded-2xl border shadow-sm bg-white/95 p-4">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">Prescription</div>
                      <div className="text-xs text-gray-500">
                        Created {fmtManila(r.created_at)}
                        {r.updated_at ? ` • Updated ${fmtManila(r.updated_at)}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status ? (
                        <span className="text-xs rounded-full px-3 py-1 bg-gray-100">
                          {String(r.status).toUpperCase()}
                        </span>
                      ) : null}
                      <span className="text-xs rounded-full px-3 py-1 bg-gray-100">
                        {(rows.length ?? 0)} item{rows.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {/* Notes for patient */}
                  {r.notes_for_patient && (
                    <div className="mt-3 text-sm">
                      <span className="font-medium">Instructions:</span> {r.notes_for_patient}
                    </div>
                  )}

                  {/* Items */}
                  <div className="mt-4">
                    <div className="text-sm font-medium mb-1">Items</div>
                    <ul className="text-sm list-disc pl-6">
                      {rows.map((ln: any) => (
                        <li key={ln.id}>
                          <span className="font-medium">{ln.generic_name}</span>{" "}
                          — {ln.strength} {ln.form} · {ln.route || "PO"} · {ln.dose_amount} {ln.dose_unit}{" "}
                          {describeFrequency(ln.frequency_code)} · {ln.duration_days} days · Qty {ln.quantity}
                          {ln.instructions ? ` — ${ln.instructions}` : ""}
                          {showPrices && ln.unit_price != null && ln.quantity != null ? (
                            <> — ₱{(ln.unit_price * ln.quantity).toFixed(2)}</>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Prices / totals (optional) */}
                  {showPrices && (
                    <div className="mt-4 text-sm">
                      <div>Subtotal: ₱{subtotal.toFixed(2)}</div>
                      {discount ? (
                        <div>
                          Discount: −₱{discount.toFixed(2)} {isActive ? "" : "(expired)"}
                          {r.discount_type === "percent" ? ` (${r.discount_value}%)` : ""}
                          {r.discount_expires_at
                            ? ` • until ${fmtManila(r.discount_expires_at)}`
                            : ""}
                        </div>
                      ) : null}
                      <div className="font-medium">Total: ₱{(total ?? 0).toFixed(2)}</div>
                    </div>
                  )}

                  {/* Footer (print link) */}
                  <div className="mt-3 text-right">
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
    </main>
  );
}

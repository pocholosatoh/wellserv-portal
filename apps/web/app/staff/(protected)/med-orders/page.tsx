"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtManila } from "@/lib/time";

type PendingOrder = {
  patient_id: string;
  full_name: string | null;
  sex: string | null;
  birth_date: string | null;
  contact_no: string | null;
  delivery_address_label: string | null;
  delivery_address_text: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  last_delivery_used_at: string | null;
};

type DeliveredOrder = {
  patient_id: string;
  full_name: string | null;
  contact_no: string | null;
  last_delivery_success_at: string;
};

const ACCENT = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

function calcAge(birth?: string | null) {
  if (!birth) return null;
  const dob = new Date(birth);
  if (Number.isNaN(+dob)) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function relativeFrom(date?: string | null) {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(+target)) return null;
  const diff = target.getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return rtf.format(days, "day");
}

export default function StaffMedOrdersPage() {
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [delivered, setDelivered] = useState<DeliveredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/staff/med-orders");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load med orders");
        if (!mounted) return;
        setPending(json.pending || []);
        setDelivered(json.delivered || []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e.message || "Failed to load med orders");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function markDelivered(pid: string) {
    setMarking(pid);
    setToast(null);
    try {
      const res = await fetch("/api/staff/med-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: pid }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to mark as delivered");

      setPending((prev) => prev.filter((p) => p.patient_id !== pid));
      setDelivered((prev) => [
        {
          patient_id: pid,
          full_name:
            prev.find((d) => d.patient_id === pid)?.full_name ||
            pending.find((p) => p.patient_id === pid)?.full_name ||
            null,
          contact_no:
            prev.find((d) => d.patient_id === pid)?.contact_no ||
            pending.find((p) => p.patient_id === pid)?.contact_no ||
            null,
          last_delivery_success_at: json.last_delivery_success_at,
        },
        ...prev.filter((d) => d.patient_id !== pid),
      ]);
      setToast("Marked as delivered.");
    } catch (e: any) {
      setToast(e.message || "Failed to update delivery status.");
    } finally {
      setMarking(null);
    }
  }

  const pendingList = useMemo(() => pending || [], [pending]);
  const deliveredList = useMemo(() => delivered || [], [delivered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Staff</p>
          <h1 className="text-2xl font-semibold text-slate-900">Med Orders</h1>
          <p className="text-sm text-slate-600">Pending delivery requests from patients.</p>
        </div>
        <Link
          href="/staff"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
        >
          Staff Home
        </Link>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 shadow-sm">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Pending Med Orders</h2>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
        </div>
        {pendingList.length === 0 && !loading ? (
          <p className="text-sm text-slate-600">No pending deliveries right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pendingList.map((p) => {
              const age = calcAge(p.birth_date);
              const since = relativeFrom(p.last_delivery_used_at);
              const detailHref = `/staff/med-orders/${encodeURIComponent(p.patient_id)}`;
              return (
                <div
                  key={p.patient_id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(detailHref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(detailHref);
                    }
                  }}
                >
                  <div className="relative space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-900">
                          {p.full_name || "Unnamed patient"}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{p.patient_id}</div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        Pending
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      {typeof age === "number" && <span>Age: {age}</span>}
                      {p.sex && <span>• Sex: {p.sex}</span>}
                      {p.contact_no && (
                        <span className="truncate">
                          • Contact: <a href={`tel:${p.contact_no}`} className="underline">{p.contact_no}</a>
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 line-clamp-2">
                      {p.delivery_address_label ? `${p.delivery_address_label}: ` : ""}
                      {p.delivery_address_text || "No address saved"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {since ? `Pending since ${since}` : "Waiting for confirmation"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Link
                        href={detailHref}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View details
                      </Link>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1"
                        style={{ backgroundColor: ACCENT, opacity: marking === p.patient_id ? 0.85 : 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          markDelivered(p.patient_id);
                        }}
                        disabled={marking === p.patient_id}
                      >
                        {marking === p.patient_id ? "Updating…" : "Mark as Delivered"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Recently Delivered</h2>
        {deliveredList.length === 0 ? (
          <p className="text-sm text-slate-600">No recent deliveries logged.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {deliveredList.map((d) => (
              <div
                key={d.patient_id + d.last_delivery_success_at}
                className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {d.full_name || "Unnamed patient"}
                    </div>
                    <div className="text-xs font-mono text-slate-500">{d.patient_id}</div>
                    {d.contact_no && (
                      <div className="text-xs text-slate-600">
                        Contact: <a href={`tel:${d.contact_no}`} className="underline">{d.contact_no}</a>
                      </div>
                    )}
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                    Delivered
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Delivered at {fmtManila(d.last_delivery_success_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// app/(doctor)/doctor/patient/[patientId]/PastConsultations.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtManila } from "@/lib/time";
import ConsultDx from "./ConsultDx";

type Consult = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_at: string; // ISO
  plan_shared: boolean | null;
  prescription_id?: string | null;
  prescription_status?: string | null;
  doctor_name_at_time?: string | null; // snapshot for relievers
  doctor?: {
    display_name?: string | null;
    full_name?: string | null;
    credentials?: string | null;
  } | null;
};

type ConsultDetails = {
  notes?: {
    notes_markdown?: string | null;
    notes_soap?: any | null;
  } | null;
  rx?: {
    id: string;
    status: string;
    items: Array<{
      generic_name: string | null;
      brand_name: string | null;
      strength: string | null;
      form: string | null;
      quantity: number | null;
      unit_price: number | null;
    }>;
    notes_for_patient?: string | null;
    valid_days?: number | null;
    valid_until?: string | null;
  } | null;
  doctor_name_at_time?: string | null;
  signing_doctor_name?: string | null;
  doctor?: Consult["doctor"];
  events?: Array<{
    id: string;
    event_type: string;
    event_text: string;
    created_at: string | null;
    referral_id?: string | null;
    referral_code?: string | null;
  }>;
};

export default function PastConsultations({
  patientId,
  initialList,
}: {
  patientId: string;
  initialList?: Consult[];
}) {
  const [list, setList] = useState<Consult[]>(initialList ?? []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<ConsultDetails | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialList);
  const [refreshing, setRefreshing] = useState(false);

  // Build a display name:
  // - Prefer "full_name, credentials" when available
  // - Else use display_name and append credentials if they're not already included
  // - Else fall back to reliever snapshot (doctor_name_at_time)
  function docName(c: {
    doctor?: Consult["doctor"];
    doctor_name_at_time?: string | null;
    signing_doctor_name?: string | null;
  }) {
    const d = c.doctor;
    const cred = (d?.credentials || "")?.trim();
    const hasCred = !!cred;

    if (d?.full_name) {
      return hasCred ? `${d.full_name}, ${cred}` : d.full_name!;
    }
    if (d?.display_name) {
      if (hasCred && !new RegExp(`,\\s*${cred}$`).test(d.display_name)) {
        return `${d.display_name}, ${cred}`;
      }
      return d.display_name;
    }
    if (c.signing_doctor_name) return c.signing_doctor_name;
    if (c.doctor_name_at_time) return c.doctor_name_at_time;
    return "Attending Doctor";
  }

  function formatDateOnly(iso?: string | null) {
    if (!iso) return null;
    const dt = new Date(iso);
    if (Number.isNaN(+dt)) return null;
    return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  const fetchList = useCallback(async () => {
    setRefreshing(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/consultations/list?patient_id=${encodeURIComponent(patientId)}`,
      );
      const j = await res.json();
      if (res.ok) setList((j.consultations || []) as Consult[]);
    } catch {
      setErr("Failed to load past consultations.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!initialList) {
      setLoading(true);
      fetchList();
      return;
    }
    setList(initialList);
    setLoading(false);
  }, [fetchList, initialList]);

  // 🔁 Listen for Rx signed events so Past Consultations reloads automatically
  useEffect(() => {
    async function onSigned(e: CustomEvent) {
      const cid = e.detail?.consultationId;
      // Always refresh the list after signing
      await fetchList();

      // If the signed consultation is currently expanded → reload its details
      if (cid && openId === cid) {
        const r = await fetch(`/api/consultations/details?id=${encodeURIComponent(cid)}`);
        const jj = await r.json();
        if (r.ok) setDetails(jj.details as ConsultDetails);
      }
    }

    async function onReferral(e: CustomEvent) {
      const cid = e.detail?.consultationId;
      const eventPid = String(e.detail?.patientId || "").toUpperCase();
      if (eventPid && eventPid !== patientId.toUpperCase()) return;
      await fetchList();
      if (cid && openId === cid) {
        const r = await fetch(`/api/consultations/details?id=${encodeURIComponent(cid)}`);
        const jj = await r.json();
        if (r.ok) setDetails(jj.details as ConsultDetails);
      }
    }

    window.addEventListener("rx:signed", onSigned as any);
    window.addEventListener("referral:generated", onReferral as any);
    return () => {
      window.removeEventListener("rx:signed", onSigned as any);
      window.removeEventListener("referral:generated", onReferral as any);
    };
  }, [patientId, openId, fetchList]);

  async function toggleOpen(id: string) {
    if (openId === id) {
      setOpenId(null);
      setDetails(null);
      return;
    }
    setOpenId(id);
    setDetails(null);
    try {
      const res = await fetch(`/api/consultations/details?id=${encodeURIComponent(id)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load details.");
      setDetails(j.details as ConsultDetails);
    } catch (e: any) {
      setErr(e.message || "Failed to load details.");
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2 gap-3">
        <h3 className="text-lg font-semibold">Past Consultations</h3>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchList();
          }}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {refreshing || loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && list.length === 0 && (
        <p className="text-sm text-gray-500">No consultations yet.</p>
      )}

      <div className="space-y-2">
        {list.map((c) => (
          <div key={c.id} className="border rounded-lg">
            <button
              type="button"
              disabled={loading}
              onClick={() => toggleOpen(c.id)}
              className="w-full text-left flex items-center justify-between px-3 py-2"
            >
              {/* Row header: show only date/time (REMOVE name here) */}
              <div className="text-sm">
                <b>{fmtManila(c.visit_at)}</b>
              </div>
              <span className="text-xs text-gray-500">{openId === c.id ? "Hide" : "View"}</span>
            </button>

            {openId === c.id && (
              <div className="px-3 pb-3">
                {!details ? (
                  <p className="text-sm text-gray-500">Loading details…</p>
                ) : (
                  <>
                    {/* Expanded: show Consulting MD with proper credentials */}
                    <div className="text-sm text-gray-500 mb-2">
                      Consulting MD: <b>{docName(details)}</b>
                    </div>

                    {details.events && details.events.length > 0 && (
                      <div className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs font-semibold uppercase text-slate-500 mb-2">
                          Timeline
                        </div>
                        <div className="space-y-1 text-sm text-slate-700">
                          {details.events.map((evt) => (
                            <div key={evt.id} className="flex flex-wrap gap-2 items-center">
                              <span>{evt.event_text}</span>
                              {evt.referral_id && (
                                <a
                                  href={`/doctor/referrals/${evt.referral_id}/print`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[#2e6468] hover:underline"
                                >
                                  {evt.referral_code || "View referral"}
                                </a>
                              )}
                              <span className="text-xs text-slate-400">
                                {fmtManila(evt.created_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="mb-4">
                      <div className="mb-4">
                        <ConsultDx consultationId={c.id} />
                      </div>
                      <div className="font-medium mb-1">Doctor Notes</div>
                      {(() => {
                        const md = details.notes?.notes_markdown?.trim() || "";
                        const soap = details.notes?.notes_soap || {};
                        const soapHasContent = ["S", "O", "A", "P"].some((k) =>
                          (soap?.[k] || "").trim(),
                        );

                        if (!md && !soapHasContent) {
                          return <p className="text-sm text-gray-500">No notes.</p>;
                        }

                        return (
                          <div className="space-y-3">
                            {md && (
                              <div>
                                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                  Markdown
                                </div>
                                <pre className="whitespace-pre-wrap text-sm">{md}</pre>
                              </div>
                            )}
                            {soapHasContent && (
                              <div>
                                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                  SOAP
                                </div>
                                <div className="text-sm space-y-1">
                                  {(["S", "O", "A", "P"] as const).map((k) => {
                                    const val = (soap?.[k] || "").trim();
                                    if (!val) return null;
                                    return (
                                      <div key={k}>
                                        <b>{k}:</b> {val}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Rx summary */}
                    <div className="mb-2">
                      <div className="font-medium mb-1">Prescription</div>
                      {!details.rx ? (
                        <p className="text-sm text-gray-500">No prescription.</p>
                      ) : (
                        <div className="text-sm">
                          {details.rx.valid_until && (
                            <div className="text-xs text-gray-500 mb-2">
                              Valid until {formatDateOnly(details.rx.valid_until) || "—"}
                              {details.rx.valid_days ? ` (${details.rx.valid_days} days)` : ""}
                            </div>
                          )}
                          {details.rx.items.map((it, i) => (
                            <div key={i}>
                              {it.generic_name}
                              {it.brand_name ? (
                                <>
                                  {" "}
                                  (<i>{it.brand_name}</i>)
                                </>
                              ) : null}
                              {" — "} {it.strength} {it.form}
                              {it.quantity != null && <span> · Qty {it.quantity}</span>}
                            </div>
                          ))}
                          {details.rx.notes_for_patient && (
                            <div className="mt-2 text-gray-600">
                              <b>Instructions:</b> {details.rx.notes_for_patient}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Print button for signed prescriptions */}
                      {details.rx?.id && details.rx?.status === "signed" && (
                        <div className="mt-3 text-right">
                          <a
                            href={`/prescription/${details.rx.id}/print`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
                          >
                            🖨️ Print Prescription
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </div>
  );
}

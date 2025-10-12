// app/(doctor)/doctor/patient/[patientId]/PastConsultations.tsx
"use client";

import { useEffect, useState } from "react";
import { fmtManila } from "@/lib/time";

type Consult = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_at: string;              // ISO
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
  } | null;
  doctor_name_at_time?: string | null;
  doctor?: Consult["doctor"];
};

export default function PastConsultations({ patientId }: { patientId: string }) {
  const [list, setList] = useState<Consult[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<ConsultDetails | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Build a display name:
  // - Prefer "full_name, credentials" when available
  // - Else use display_name and append credentials if they're not already included
  // - Else fall back to reliever snapshot (doctor_name_at_time)
  function docName(c: { doctor?: Consult["doctor"]; doctor_name_at_time?: string | null }) {
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
    if (c.doctor_name_at_time) return c.doctor_name_at_time;
    return "Attending Doctor";
  }

  // ⬇️ Add this initial load effect
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/consultations/list?patient_id=${encodeURIComponent(patientId)}`);
        const j = await res.json();
        if (!aborted && res.ok) setList((j.consultations || []) as Consult[]);
      } catch {
        if (!aborted) setErr("Failed to load past consultations.");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [patientId]);  

  // 🔁 Listen for Rx signed events so Past Consultations reloads automatically
  useEffect(() => {
    async function reloadList() {
      const res = await fetch(`/api/consultations/list?patient_id=${encodeURIComponent(patientId)}`);
      const j = await res.json();
      if (res.ok) setList((j.consultations || []) as Consult[]);
    }

    async function onSigned(e: CustomEvent) {
      const cid = e.detail?.consultationId;
      // Always refresh the list after signing
      await reloadList();

      // If the signed consultation is currently expanded → reload its details
      if (cid && openId === cid) {
        const r = await fetch(`/api/consultations/details?id=${encodeURIComponent(cid)}`);
        const jj = await r.json();
        if (r.ok) setDetails(jj.details as ConsultDetails);
      }
    }

    window.addEventListener("rx:signed", onSigned as any);
    return () => window.removeEventListener("rx:signed", onSigned as any);
  }, [patientId, openId]);


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
      <h3 className="text-lg font-semibold mb-2">Past Consultations</h3>

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

                    {/* Notes */}
                    <div className="mb-4">
                      <div className="font-medium mb-1">Doctor Notes</div>
                      {details.notes ? (
                        <>
                          {details.notes.notes_markdown ? (
                            <pre className="whitespace-pre-wrap text-sm">
                              {details.notes.notes_markdown}
                            </pre>
                          ) : details.notes.notes_soap ? (
                            <div className="text-sm space-y-1">
                              {(["S","O","A","P"] as const).map((k) => (
                                <div key={k}>
                                  <b>{k}:</b> {details.notes!.notes_soap?.[k] ?? ""}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No notes.</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">No notes.</p>
                      )}
                    </div>

                    {/* Rx summary */}
                    <div className="mb-2">
                      <div className="font-medium mb-1">Prescription</div>
                      {!details.rx ? (
                        <p className="text-sm text-gray-500">No prescription.</p>
                      ) : (
                        <div className="text-sm">
                          {details.rx.items.map((it, i) => (
                            <div key={i}>
                            {it.generic_name}
                            {it.brand_name ? <> (<i>{it.brand_name}</i>)</> : null}
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

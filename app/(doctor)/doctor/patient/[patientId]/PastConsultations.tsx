// app/(doctor)/doctor/patient/[patientId]/PastConsultations.tsx
"use client";

import { useEffect, useState } from "react";
import { fmtManila } from "@/lib/time";

type Consult = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  doctor_name_at_time?: string | null;
  visit_at: string;              // ISO string
  plan_shared: string | null;
  doctor?: {
    full_name?: string | null;
    display_name?: string | null;
    credentials?: string | null;
    prc_no?: string | null;
    ptr_no?: string | null;
    s2_no?: string | null;
    specialty?: string | null;
    affiliations?: string | null;
  } | null;
};

export default function PastConsultations({ patientId }: { patientId: string }) {
  const [list, setList] = useState<Consult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/consultations/list?patient_id=${encodeURIComponent(patientId)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed");
        setList((json.consultations || []) as Consult[]);
        setErr(null);
      } catch (e: any) {
        setErr(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  async function loadDetails(id: string) {
    setSelected(id);
    setDetails(null);
    const res = await fetch(`/api/consultations/details?id=${encodeURIComponent(id)}`);
    const json = await res.json();
    if (res.ok) setDetails(json);
    else console.error("Failed to load details", json);
  }

  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-2">Past Consultations</h3>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !list.length ? (
        <p className="text-sm text-gray-500">No past consultations.</p>
      ) : (
        <>
          <div className="max-h-48 overflow-auto border rounded">
            {list.map((c) => {
              // Build "Full Name, Credentials" once, then render it below
              const d = c.doctor;
              const docLabel = d
                ? `${d.full_name || d.display_name || ""}${
                    d.credentials ? `, ${d.credentials}` : ""
                  }`
                : (c.doctor_name_at_time || "—");

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => loadDetails(c.id)}
                  className={`w-full text-left px-3 py-2 border-b last:border-0 hover:bg-gray-50 ${
                    selected === c.id ? "bg-gray-100" : ""
                  }`}
                >
                  <div className="text-sm">
                    <b>{fmtManila(c.visit_at)}</b>
                    <span className="text-gray-600"> · {docLabel}</span>
                  </div>
                  {c.plan_shared ? (
                    <div className="text-xs text-gray-600 line-clamp-1">
                      {c.plan_shared}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="mt-4 border rounded p-3">
              {!details ? (
                <p className="text-sm text-gray-500">Loading details…</p>
              ) : (
                <>
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
                            {(["S", "O", "A", "P"] as const).map((k) => (
                              <div key={k}>
                                <b>{k}:</b>{" "}
                                {details.notes.notes_soap[k] || ""}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            No notes content.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No notes for this consultation.
                      </p>
                    )}
                  </div>

                  {/* Prescriptions */}
                  <div>
                    <div className="font-medium mb-1">Prescriptions</div>
                    {!details.prescriptions?.length ? (
                      <p className="text-sm text-gray-500">No prescriptions.</p>
                    ) : (
                      <div className="space-y-3">
                        {details.prescriptions.map((r: any) => (
                          <div key={r.id} className="border rounded p-2">
                            <div className="text-xs text-gray-600 flex justify-between">
                              <span>Status: {r.status}</span>
                              <span>{fmtManila(r.created_at)}</span>
                            </div>
                            {r.notes_for_patient && (
                              <div className="text-sm mt-1">
                                <b>Instructions:</b> {r.notes_for_patient}
                              </div>
                            )}
                            {!!r.items?.length && (
                              <ul className="text-sm list-disc pl-6 mt-1">
                                {r.items.map((ln: any) => (
                                  <li key={ln.id}>
                                    <span className="font-medium">
                                      {ln.generic_name}
                                    </span>{" "}
                                    — {ln.strength} {ln.form} · {ln.route || "PO"} ·{" "}
                                    {ln.dose_amount} {ln.dose_unit} {ln.frequency_code} ·{" "}
                                    {ln.duration_days} days · Qty {ln.quantity}
                                    {ln.instructions ? ` — ${ln.instructions}` : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </div>
  );
}

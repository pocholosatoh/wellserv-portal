// app/prescription/[id]/print/page.tsx
import Image from "next/image";
import { getSupabase } from "@/lib/supabase";
import { fmtManila } from "@/lib/time";
import PrintButton from "./PrintButton";

type Props = { params: { id: string } };

export default async function PrintRxPage({ params }: Props) {
  const { id } = params;
  const supabase = getSupabase();

  // Rx header
  const { data: rx } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rx) return <div className="p-6 text-red-600">Prescription not found.</div>;

  // Lines
  const { data: items } = await supabase
    .from("prescription_items")
    .select("*")
    .eq("prescription_id", id)
    .order("created_at", { ascending: true });

  // Patient (optional)
  const { data: patient } = await supabase
    .from("patients")
    .select("patient_id, full_name, age, sex")
    .eq("patient_id", rx.patient_id)
    .maybeSingle();

  // Doctor (signature block)
  let doctor: any = null;
  if (rx.doctor_id) {
    const { data } = await supabase
      .from("doctors")
      .select("full_name, credentials, specialty, affiliations, prc_no, ptr_no, s2_no, signature_image_url")
      .eq("id", rx.doctor_id)
      .maybeSingle();
    doctor = data;
  }

  function DocLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <div className="text-[11px] text-gray-700">{label}: {value}</div>;
}

  return (
    <div className="p-6 print:p-0">
      {/* Header with logo */}
      <div className="flex items-center gap-3 mb-2">
        {/* Local asset: /public/logo.png */}
        <div className="relative" style={{ width: 44, height: 44 }}>
          <Image src="/wellserv-logo.png" alt="Logo" fill sizes="44px" priority />
        </div>
        <div>
          <div className="text-lg font-semibold leading-tight">WellServ Diagnostics</div>
          <div className="text-xs text-gray-600 leading-tight">Prescription</div>
        </div>
      </div>

      {/* Patient meta */}
      <div className="text-sm mb-3 grid grid-cols-2 gap-2">
        <div><b>Date:</b> {fmtManila(rx.created_at)}</div>
        <div><b>Patient ID:</b> {rx.patient_id}</div>
        {patient?.full_name && (
          <div className="col-span-2"><b>Patient:</b> {patient.full_name}</div>
        )}
      </div>

      {/* Items (NO prices on print) */}
      <div className="mb-3">
        <div className="font-medium mb-1">Items</div>
        <ol className="text-sm list-decimal pl-6 space-y-1">
          {(items || []).map((ln: any, idx: number) => (
            <li key={idx}>
              <span className="font-medium">{ln.generic_name}</span>{" "}
              — {ln.strength} {ln.form} · {ln.route || "PO"} · {ln.dose_amount} {ln.dose_unit}{" "}
              {ln.frequency_code} · {ln.duration_days} days · Qty {ln.quantity}
              {ln.instructions ? ` — ${ln.instructions}` : ""}
            </li>
          ))}
        </ol>
      </div>

      {/* Instructions */}
      {rx.notes_for_patient && (
        <div className="text-sm mb-6">
          <b>Shared instructions:</b> {rx.notes_for_patient}
        </div>
      )}

      {/* Signature block */}
      <div className="mt-10 grid grid-cols-2 gap-6 items-end">
        <div />
        <div className="mt-8 text-center">
          {/* signature image if you plan to store it */}
          {rx.doctor?.signature_image_url ? (
            <div className="h-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rx.doctor.signature_image_url}
                alt="signature"
                className="h-10 mx-auto object-contain"
              />
            </div>
          ) : <div className="h-10" />}

          <div className="font-medium">
            {rx.doctor?.full_name || rx.doctor?.display_name || ""}
            {rx.doctor?.credentials ? `, ${rx.doctor.credentials}` : ""}
          </div>

          {rx.doctor?.specialty && (
            <div className="text-sm text-gray-700">{rx.doctor.specialty}</div>
          )}

          <div className="mt-1 space-y-0.5">
            <DocLine label="PRC" value={rx.doctor?.prc_no} />
            <DocLine label="PTR" value={rx.doctor?.ptr_no} />
            <DocLine label="S2"  value={rx.doctor?.s2_no} />
          </div>
        </div>
      </div>

      {/* Print button */}
      <div className="mt-6 print-hide">
        <PrintButton />
      </div>

      {/* Watermark + print CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body::before {
              content: "";
              position: fixed;
              inset: 0;
              background: url("/watermark.png") center / 420px no-repeat;
              opacity: 0.06;
              pointer-events: none;
            }
            @media print {
              @page { margin: 12mm; }
              .print-hide { display: none !important; }
              body::before { opacity: 0.08; }
            }
          `,
        }}
      />
    </div>
  );
}

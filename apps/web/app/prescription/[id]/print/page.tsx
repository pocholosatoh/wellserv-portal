// app/prescription/[id]/print/page.tsx
import Image from "next/image";
import { headers } from "next/headers";
import { describeFrequency } from "@/lib/rx";
import "./print.css";
import { FitToA5 } from "./FitToA5";

// Next 15+: headers() is async
async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function getRx(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/prescriptions/${id}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Rx fetch failed", res.status, text);
    throw new Error(`Failed to load prescription (${res.status})`);
  }
  return res.json();
}

function calcAge(iso?: string | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(+dob)) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

type PageContext = { params: Promise<{ id: string }> };

export default async function PrintRxPage({ params }: PageContext) {
  const { id } = await params;
  const data = await getRx(id);

  // map patient fields (birthday + sex) from API
  const name = data.patient?.full_name ?? "Unknown";
  const dobISO = data.patient?.birthday ?? null;
  const age = calcAge(dobISO);
  const dobStr = dobISO ? new Date(dobISO).toLocaleDateString("en-PH") : null;
  const sex = data.patient?.sex ?? null;
  const validUntilStr = (() => {
    if (!data.valid_until) return null;
    const dt = new Date(data.valid_until);
    if (Number.isNaN(+dt)) return null;
    return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  })();

  return (
    <FitToA5 className="rx a5 mx-auto bg-white text-gray-900">
      {/* Header: logo + date under it; add a bit more bottom padding */}
      <div className="pt-2 pb-4 border-b">
        <div className="flex items-center justify-center">
          <Image
            src="/wellserv-logo.png"
            alt="WELLSERV"
            width={360}
            height={96}
            className="h-16 w-auto"
            priority
            unoptimized
          />
        </div>
        <div className="text-xs text-right mt-1 pr-1">
          Date: {new Date(data.created_at).toLocaleDateString("en-PH")}
        </div>
      </div>

      {/* Patient block: big name + age/sex/DOB */}
      <div className="mt-2 border-b pb-2">
        <div className="text-lg font-semibold">{name}</div>
        <div className="text-sm text-gray-700">
          {age != null ? `${age} y/o` : "—"}
          {sex ? ` • ${sex}` : ""}
          {dobStr ? ` • DOB: ${dobStr}` : ""}
        </div>
      </div>

      {/* Rx list */}
      <ol className="mt-3 space-y-2 list-decimal pl-5 text-[13px]">
        {data.items.map((ln: any) => (
          <li key={ln.id} className="leading-snug">
            <div className="font-medium">
              {ln.generic_name}
              {ln.brand_name ? (
                <>
                  {" "}
                  (<span className="text-gray-600 italic">{ln.brand_name}</span>)
                </>
              ) : null}
              {" — "} {ln.strength} {ln.form}
            </div>
            <div className="text-[12px]">
              {ln.route || "PO"} · {ln.dose_amount} {ln.dose_unit} ·{" "}
              {describeFrequency(ln.frequency_code)} · {ln.duration_days} days · Qty {ln.quantity}
            </div>
            {ln.instructions ? (
              <div className="text-[12px] italic">Instruction: {ln.instructions}</div>
            ) : null}
          </li>
        ))}
      </ol>

      {/* Doctor notes */}
      {data.notes_for_patient ? (
        <div className="mt-3 p-2 border rounded text-[12px]">
          <div className="font-medium">Doctor’s Notes</div>
          <div>{data.notes_for_patient}</div>
        </div>
      ) : null}

      {/* Signature block */}
      <div className="mt-8 flex items-end">
        <div>
          {data.doctor?.signature_url ? (
            <img src={data.doctor.signature_url} alt="Signature" style={{ height: 42 }} />
          ) : (
            <div className="text-[11px] text-gray-500 italic">Not valid without Dr&apos;s signature:</div>
          )}
          <div className="border-t border-gray-800 mt-1 w-56" />

          <div className="text-[12px] leading-tight">
            {/* Name line: full_name, credentials  (falls back to display_name) */}
            <div className="font-medium">
              {(data.doctor?.full_name || data.doctor?.display_name || "Consulting Physician")}
              {data.doctor?.credentials ? `, ${data.doctor.credentials}` : ""}
            </div>

            {/* Optional lines (only render if present) */}
            {data.doctor?.specialty ? <div>{data.doctor.specialty}</div> : null}
            {data.doctor?.affiliations ? <div>{data.doctor.affiliations}</div> : null}
            {data.doctor?.prc_no ? <div>PRC No.: {data.doctor.prc_no}</div> : null}
            {data.doctor?.ptr_no ? <div>PTR No.: {data.doctor.ptr_no}</div> : null}
            {data.doctor?.s2_no ? <div>S2 No.: {data.doctor.s2_no}</div> : null}
          </div>
        </div>

        <div className="ml-auto text-right text-[10px] text-gray-500">
          {validUntilStr ? (
            <>
              <div className="text-[11px] font-semibold text-gray-700">
                Valid only until: {validUntilStr}
              </div>
              <div>
                This prescription is valid as issued by the prescribing physician. You can verify by calling branch below.
              </div>
            </>
          ) : (
            "This prescription is valid as issued by the prescribing physician. You can verify by calling branch below."
          )}
        </div>
      </div>

      {/* Footer (your text) */}
      <div className="mt-6 text-[10px] text-gray-600 border-t pt-1 flex items-center justify-between">
        <div>San Isidro, NE • Tel: 0993-985-4927 | San Leonardo, NE • Tel: 0994-276-0253</div>
        <div>Rx ID: {data.id}</div>
      </div>

      {/* Watermark pinned to lower-left */}
      <div className="rx-watermark-svg" aria-hidden>
        <svg viewBox="0 0 100 120" preserveAspectRatio="none">
          {/* x=0, y=100 = bottom-left of the SVG box */}
          <text x="2" y="125">℞</text>
        </svg>
      </div>
    </FitToA5>
  );
}

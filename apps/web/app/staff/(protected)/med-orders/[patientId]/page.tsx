import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { fmtManila } from "@/lib/time";
import { DetailActionsClient } from "../DetailActionsClient";

type PatientDelivery = {
  patient_id: string;
  full_name: string | null;
  sex: string | null;
  birthday: string | null;
  contact: string | null;
  delivery_address_label: string | null;
  delivery_address_text: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  last_delivery_used_at: string | null;
  last_delivery_success_at: string | null;
};

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

export default async function MedOrderDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("patients")
    .select(
      "patient_id, full_name, sex, birthday, contact, delivery_address_label, delivery_address_text, delivery_lat, delivery_lng, delivery_notes, last_delivery_used_at, last_delivery_success_at",
    )
    .eq("patient_id", patientId)
    .maybeSingle();

  if (error || !data) return notFound();

  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";
  const age = calcAge(data.birthday);
  const googleMapsUrl =
    data.delivery_lat != null && data.delivery_lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${data.delivery_lat},${data.delivery_lng}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Staff</p>
          <h1 className="text-2xl font-semibold text-slate-900">Med Order Detail</h1>
          <p className="text-sm text-slate-600">Delivery details for {data.patient_id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/staff/med-orders"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Back to list
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/95 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-slate-900">
              {data.full_name || "Unnamed patient"}
            </div>
            <div className="text-sm font-mono text-slate-600">{data.patient_id}</div>
            <div className="text-sm text-slate-600">
              {age != null ? `Age: ${age}` : "Age: —"} {data.sex ? `• ${data.sex}` : ""}
            </div>
            {data.contact && (
              <div className="text-sm text-slate-700">
                Contact:{" "}
                <a href={`tel:${data.contact}`} className="font-semibold underline">
                  {data.contact}
                </a>
              </div>
            )}
          </div>
          <div className="text-right text-xs text-slate-500 space-y-1">
            <div>Last requested: {fmtManila(data.last_delivery_used_at)}</div>
            <div>
              Last delivered:{" "}
              {data.last_delivery_success_at ? fmtManila(data.last_delivery_success_at) : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/95 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Details</h2>
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open in Google Maps
            </a>
          )}
        </div>
        <div className="space-y-1 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">
            {data.delivery_address_label || "No label"}
          </div>
          <div className="whitespace-pre-wrap leading-relaxed">
            {data.delivery_address_text || "No address saved"}
          </div>
          <div className="text-slate-600">
            Notes: {data.delivery_notes ? data.delivery_notes : "None"}
          </div>
          {data.delivery_lat != null && data.delivery_lng != null && (
            <div className="text-xs text-slate-500">
              Lat/Lng: {data.delivery_lat}, {data.delivery_lng}
            </div>
          )}
        </div>
      </div>

      <DetailActionsClient
        accent={accent}
        patient={{
          patient_id: data.patient_id,
          full_name: data.full_name,
          contact_no: data.contact,
          googleMapsUrl,
          delivery_address_text: data.delivery_address_text,
          delivery_notes: data.delivery_notes,
          last_delivery_success_at: data.last_delivery_success_at,
        }}
      />
    </div>
  );
}

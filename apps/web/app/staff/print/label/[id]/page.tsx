// app/staff/print/label/[id]/page.tsx
import Label50x30 from "@/app/staff/_components/Label50x30";
import PrintButton from "@/app/staff/_components/PrintButton";
import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";

const supa = () => getSupabase();

export const metadata: Metadata = {
  title: "Print Label",
};

function manilaTodayISO(): string {
  const tz = process.env.APP_TZ || "Asia/Manila";
  const dt = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

export default async function LabelPage(props: {
  params: Promise<{ id: string }>; // 👈 params is a Promise in Next 15
}) {
  const { id } = await props.params; // 👈 await it
  const db = supa();

  // 1) Load encounter
  const { data: enc, error: encErr } = await db
    .from("encounters")
    .select("id,patient_id,branch_code,visit_date_local")
    .eq("id", id)
    .maybeSingle();

  if (encErr) {
    return (
      <div className="p-4 text-red-600">
        Error loading encounter: {encErr.message}
      </div>
    );
  }
  if (!enc) {
    return <div className="p-4">Encounter not found.</div>;
  }

  // 2) Load patient
  const { data: pat } = await db
    .from("patients")
    .select("patient_id,full_name,sex,age")
    .eq("patient_id", enc.patient_id)
    .maybeSingle();

  const payload = {
    patient_id: pat?.patient_id ?? enc.patient_id,
    full_name: pat?.full_name ?? "",
    sex: (pat?.sex ?? "") as "M" | "F" | "",
    age: (pat?.age ?? null) as number | null,
    date_label: (enc.visit_date_local as string) || manilaTodayISO(),
    branch: ((enc.branch_code as "SI" | "SL") || "SI") as "SI" | "SL",
  };

  return (
    <>
      {/* Screen-only print button */}
      <div className="toolbar print:hidden">
        <PrintButton label="Print Label" />
      </div>

      {/* The actual label (preview on screen, exact size in print) */}
      <div className="wrap">
        <div className="preview">
          <div className="label-sheet">
            <Label50x30 {...payload} />
          </div>
        </div>
      </div>

      {/* Page-scoped styles */}
      <style>{`
        @media screen {
          html, body { background:#f3f4f6; margin:0; padding:0; }
          .wrap { min-height: 100dvh; display: grid; place-items: center; padding: 24px; }
          .preview { box-shadow: 0 12px 32px rgba(0,0,0,.18); border-radius: 12px; overflow: hidden; }
          .toolbar { position: fixed; top: 12px; right: 12px; z-index: 10; }
        }
        @media print {
          @page { size: 50mm 30mm; margin: 0; }
          html, body { width: 50mm; height: 30mm; margin: 0; padding: 0; background: #fff; }
          .wrap { padding: 0; }
          .preview { box-shadow: none !important; border-radius: 0; }
          .toolbar { display: none !important; }
        }
        .label-sheet { width: 50mm; height: 30mm; background: #fff; }
      `}</style>
    </>
  );
}

/* Optional: dynamic title also needs awaiting params in Next 15
export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params;
  const db = supa();
  const { data: enc } = await db
    .from("encounters").select("patient_id").eq("id", id).maybeSingle();
  const pid = enc?.patient_id || "Label";
  return { title: `Print Label — ${pid}` };
}
*/

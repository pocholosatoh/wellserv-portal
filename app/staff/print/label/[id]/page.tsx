// app/staff/print/label/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";
import Label50x30 from "@/app/staff/_components/Label50x30";
import PrintButton from "@/app/staff/_components/PrintButton";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function manilaTodayISO(): string {
  const tz = process.env.APP_TZ || "Asia/Manila";
  const dt = new Date();
  // en-CA = YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(dt);
}

export default async function LabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supa();

  // 1) Load encounter
  const { data: enc, error: encErr } = await db
    .from("encounters")
    .select("id,patient_id,branch_code,visit_date_local")
    .eq("id", id)
    .maybeSingle();

  if (encErr) {
    return (
      <div className="p-4 text-red-600">Error loading encounter: {encErr.message}</div>
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
    date: (enc.visit_date_local as string) || manilaTodayISO(),
    branch: ((enc.branch_code as "SI" | "SL") || "SI") as "SI" | "SL",
  };

  return (
    <html>
      <head>
      <meta charSet="utf-8" />
      <title>{`Print Label — ${payload.patient_id}`}</title>  {/* ✅ single string */}
        <style>{`
          /* Screen preview */
          @media screen {
            html, body { background:#f3f4f6; margin:0; padding:0; }
            .wrap { min-height: 100dvh; display: grid; place-items: center; padding: 24px; }
            .preview { box-shadow: 0 12px 32px rgba(0,0,0,.18); border-radius: 12px; overflow: hidden; }
            .toolbar { position: fixed; top: 12px; right: 12px; }
          }
          /* PRINT: lock to 50x30mm; zero margins around page and label */
          @media print {
            @page { size: 50mm 30mm; margin: 0; }
            html, body { width: 50mm; height: 30mm; margin: 0; padding: 0; background: #fff; }
            .wrap { padding: 0; }
            .preview { box-shadow: none !important; border-radius: 0; }
            .toolbar { display: none !important; }
          }
          /* Shared label box size for both modes */
          .label-sheet { width: 50mm; height: 30mm; background: #fff; }
        `}</style>
      </head>
      <body>
        <div className="wrap">
          {/* Screen-only print button */}
          <div className="toolbar print:hidden">
            <PrintButton label="Print Label" />
          </div>

          {/* The actual label (preview box on screen, exact size in print) */}
          <div className="preview">
            <div className="label-sheet">
              {/* If your Label50x30 prop names differ, this spread keeps it working */}
              <Label50x30 {...(payload as any)} />
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

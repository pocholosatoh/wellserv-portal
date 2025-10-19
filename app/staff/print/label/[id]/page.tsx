import { createClient } from "@supabase/supabase-js";
import Label50x30 from "@/app/staff/_components/Label50x30";
import PrintButton from "@/app/staff/_components/PrintButton";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function manilaTodayISO(): string {
  const dt = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TZ || "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
  // en-CA gives YYYY-MM-DD
  return fmt.format(dt);
}

export default async function LabelPage(
    { params }: { params: Promise<{ id: string }> }
  ) {
  const { id } = await params;
  const db = supa();

  // Load encounter + patient
  const { data: enc } = await db
    .from("encounters")
    .select("id,patient_id,branch_code,created_at,visit_date_local")
    .eq("id", id)
    .maybeSingle();

  if (!enc) {
    return <div className="p-4">Encounter not found.</div>;
  }

  const { data: pat } = await db
    .from("patients")
    .select("patient_id,full_name,sex,age")
    .eq("patient_id", enc.patient_id)
    .maybeSingle();

  const dateLabel = (enc.visit_date_local as string) || manilaTodayISO();
  const branch = (enc.branch_code as "SI" | "SL") || "SI";

  return (
      <html>
        <head>
          <style>{`
            /* Screen preview */
            @media screen {
              body { background:#f3f4f6; margin:0; padding:24px; }
              .preview { box-shadow: 0 10px 30px rgba(0,0,0,.15); }
            }

            /* PRINT: lock to 50x30mm and remove ALL margins */
            @media print {
              @page { size: 50mm 30mm; margin: 0; }
              html, body { width: 50mm; height: 30mm; margin: 0; padding: 0; }
              .label-sheet { width: 50mm; height: 30mm; overflow: hidden; }
              /* Hide any screen-only padding/shadows */
              .preview { box-shadow: none !important; }
            }

            /* Shared label box */
            .label-sheet {
              background: #fff;
              display: block;
            }
          `}</style>
        </head>
        <body>
          <div className="label-sheet preview">
            {/* your existing label contents ONLY, no extra wrappers with min-h or big margins */}
            {/* ... PID, name, sex/age/date, barcode */}
          </div>
        </body>
      </html>
    );
  }
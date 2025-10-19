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
    <div className="p-4 print:p-0">
      {/* replace the inline onClick button with the client component */}
      <div className="mb-2 flex items-center gap-2 print:hidden">
        <PrintButton label="Print Label" />
      </div>

      <Label50x30
        patient_id={enc.patient_id}
        full_name={pat?.full_name || ""}
        sex={(pat?.sex || "").toUpperCase()}
        age={pat?.age ?? null}
        date_label={dateLabel}
        branch={branch}
      />
    </div>
  );
}
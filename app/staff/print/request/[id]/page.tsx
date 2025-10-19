// app/staff/print/request/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";
import PrintButton from "@/app/staff/_components/PrintButton";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function formatNowPH() {
  const tz = process.env.APP_TZ || "Asia/Manila";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: tz, year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date());
}
function formatYMDToNice(d?: string | null) {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(+dt)
    ? d
    : new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "2-digit" }).format(dt);
}

export default async function RequestA5Page(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = supa();

  const { data: enc } = await db
    .from("encounters")
    .select("id,patient_id,branch_code,visit_date_local,notes_frontdesk")
    .eq("id", id)
    .maybeSingle();

  if (!enc) return <div className="p-4">Encounter not found.</div>;

  const { data: pat } = await db
    .from("patients")
    .select("patient_id,full_name,sex,age,address,contact,birthday")
    .eq("patient_id", enc.patient_id)
    .maybeSingle();

  const { data: ord } = await db
    .from("order_items")
    .select("code_or_name")
    .eq("encounter_id", enc.id)
    .order("created_at", { ascending: true });

  const tests = (ord && ord[0]?.code_or_name) || enc.notes_frontdesk || "";

  return (
    <div className="p-6 print:p-0">
      {/* toolbar */}
      <div className="mb-3 flex items-center gap-2 print:hidden">
        <PrintButton label="Print A5" />
      </div>

      {/* document */}
      <div className="a5">
        {/* Header */}
        <header className="head">
          <div className="brand">
            <img src="/wellserv-logo.png" alt="Wellserv logo" className="logo" />
            <div className="brand-text">
              <div className="corp">WELLSERV MEDICAL CORPORATION</div>
              <div className="branch">Branch: {enc.branch_code}</div>
            </div>
          </div>
          <div className="doc-title">LAB REQUEST</div>
        </header>

        <hr className="rule" />

        {/* Patient block */}
        <section className="grid-2">
          <div className="field"><b>Patient ID:</b> {pat?.patient_id}</div>
          <div className="field"><b>Date:</b> {enc.visit_date_local ? formatYMDToNice(enc.visit_date_local as string) : formatNowPH()}</div>
          <div className="field"><b>Name:</b> {pat?.full_name}</div>
          <div className="field">
            <b>Sex:</b> {(pat?.sex || "").toUpperCase()} &nbsp; <b>Age:</b> {pat?.age ?? "-"}
          </div>
          <div className="field"><b>Birthday:</b> {formatYMDToNice(pat?.birthday as any)}</div>
          <div className="field"><b>Contact:</b> {pat?.contact || "-"}</div>
          <div className="field wide"><b>Address:</b> {pat?.address || "-"}</div>
        </section>

        {/* Tests */}
        <section>
          <div className="subtitle">Requested Tests</div>
          <div className="tests">{tests}</div>
        </section>

        {/* Footer */}
        <footer className="foot">
          <div>Printed: {formatNowPH()}</div>
        </footer>
      </div>

      {/* styles (plain <style>, server-safe) */}
      <style>{`
        :root { --accent: #44969b; }

        .a5 {
          width: 148mm; min-height: 210mm; background: #ffffff; color: #0f172a;
          border: 1px solid #e5e7eb; box-sizing: border-box; padding: 12mm; margin: 0 auto;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
        }

        .head { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8mm; }
        .brand { display: flex; align-items: center; gap: 6mm; }
        .logo { width: 55mm; height: 22mm; object-fit: contain; }
        .brand-text .corp { font-weight: 700; letter-spacing: .2px; font-size: 0px; }
        .brand-text .branch { font-weight: 700; color: #475569; margin-top: 1mm; font-size: 12px; }

        .doc-title {
          justify-self: end;
          font-size: 18px; font-weight: 800;
          color: var(--accent);
          padding: 3mm 6mm; border: 1.5px solid var(--accent); border-radius: 8px;
        }

        .rule { border: none; border-top: 2px solid #e2e8f0; margin: 6mm 0 5mm; }

        .grid-2 {
          display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 10mm; font-size: 12px; line-height: 1.35;
        }
        .grid-2 .field.wide { grid-column: 1 / -1; }

        .subtitle { font-weight: 700; margin: 6mm 0 2mm; color: #334155; }
        .tests {
          white-space: pre-wrap; border: 1.5px dashed #94a3b8; padding: 5mm; min-height: 28mm; border-radius: 6px;
          background: #f8fafc;
        }

        .foot { margin-top: 10mm; font-size: 11px; color: #334155; display: flex; justify-content: flex-end; }
        @media screen { .a5 { background: #fff; } }
      `}</style>

      <style>{`
        @media print {
          @page { size: A5; margin: 10mm; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}

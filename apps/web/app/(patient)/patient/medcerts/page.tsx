import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

const DATE_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: process.env.APP_TZ || "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return DATE_FMT.format(dt);
}

function supa() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function PatientMedCertsPage() {
  const session = await getSession();
  if (!session || session.role !== "patient") redirect("/login?next=/patient/medcerts");

  const db = supa();
  const { data, error } = await db
    .from("medical_certificates")
    .select("id, certificate_no, issued_at, valid_until, diagnosis_text, status")
    .eq("patient_id", session.patient_id)
    .order("issued_at", { ascending: false });

  const certs = error ? [] : data || [];

  return (
    <main className="min-h-dvh bg-[#f8fafb] px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Patient Portal</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Medical Certificates</h1>
              <p className="mt-1 text-sm text-slate-600">
                All certificates issued for <span className="font-mono text-slate-800">{session.patient_id}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/patient"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300 hover:bg-white"
              >
                Home
              </Link>
              <Link
                href="/patient/results"
                className="rounded-full border border-[#2e6468] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#2e6468] hover:bg-[#2e6468]/5"
              >
                View Results
              </Link>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          {error && (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Failed to load certificates. Please try again later.
            </p>
          )}

          {!error && certs.length === 0 && (
            <p className="text-sm text-slate-600">No medical certificates have been issued for your account.</p>
          )}

          {!error && certs.length > 0 && (
            <ul className="space-y-4">
              {certs.map((cert) => (
                <li
                  key={cert.id}
                  className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm ring-1 ring-black/0 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Certificate No. {cert.certificate_no || cert.id}
                      </div>
                      <div className="text-xs text-slate-500">
                        Issued: {formatDate(cert.issued_at)} • Valid until {formatDate(cert.valid_until)}
                      </div>
                    </div>
                    <span className="rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide text-slate-600">
                      {cert.status || "issued"}
                    </span>
                  </div>
                  {cert.diagnosis_text && (
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Diagnosis:</span> {cert.diagnosis_text}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

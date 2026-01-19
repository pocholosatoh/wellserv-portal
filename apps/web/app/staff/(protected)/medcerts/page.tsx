// app/staff/(protected)/medcerts/page.tsx
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { TodayPatientsQuickList } from "@/app/staff/_components/TodayPatientsQuickList";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: process.env.APP_TZ || "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function normalizePatientId(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().toUpperCase();
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return DATE_FMT.format(dt);
}

export default async function StaffMedCertsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const rawInput =
    (Array.isArray(sp.patient) ? sp.patient[0] : sp.patient) ||
    (Array.isArray(sp.pid) ? sp.pid[0] : sp.pid) ||
    "";
  const patientId = normalizePatientId(rawInput);

  let certs: any[] | null = null;
  let fetchError: string | null = null;

  if (patientId) {
    try {
      const db = getSupabase();
      const { data, error } = await db
        .from("medical_certificates")
        .select(
          "id, certificate_no, issued_at, valid_until, doctor_snapshot, status, diagnosis_text",
        )
        .eq("patient_id", patientId)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      certs = data || [];
    } catch (err: any) {
      fetchError = err?.message || "Failed to load certificates.";
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Medical Certificates</h1>
        <p className="mt-1 text-sm text-gray-600">
          Look up previously issued certificates by patient ID. Results show certificates issued in
          the doctor workspace.
        </p>
      </header>

      <TodayPatientsQuickList
        targetPath="/staff/medcerts"
        queryParam="patient"
        actionLabel="Load certificates"
      />

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
          <label className="flex-1 text-sm font-medium text-gray-700">
            Patient ID
            <input
              name="patient"
              defaultValue={rawInput}
              placeholder="e.g., SATOH010596"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-base uppercase tracking-wide"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Search
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-500">
          Tip: We normalize the ID to uppercase automatically.
        </p>
      </section>

      {patientId ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Results for <span className="font-mono">{patientId}</span>
            </h2>
          </div>

          {fetchError && (
            <p className="mt-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {fetchError}
            </p>
          )}

          {!fetchError && certs && certs.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">
              No medical certificates were generated for this patient.
            </p>
          )}

          {!fetchError && certs && certs.length > 0 && (
            <ul className="mt-4 space-y-4">
              {certs.map((cert) => (
                <li
                  key={cert.id}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Certificate No. {cert.certificate_no || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Issued {formatDate(cert.issued_at)} • Valid until{" "}
                        {formatDate(cert.valid_until)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border px-3 py-1 text-xs uppercase tracking-wide text-gray-600">
                        {cert.status || "unknown"}
                      </span>
                      <Link
                        href={`/doctor/medical-certificates/${cert.id}/print`}
                        target="_blank"
                        className="rounded-full border border-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent hover:bg-accent/5"
                      >
                        View / Print
                      </Link>
                    </div>
                  </div>
                  {cert.doctor_snapshot?.full_name && (
                    <div className="mt-2 text-xs text-gray-600">
                      Doctor: {cert.doctor_snapshot.full_name}
                      {cert.doctor_snapshot.credentials
                        ? `, ${cert.doctor_snapshot.credentials}`
                        : ""}
                    </div>
                  )}
                  {cert.diagnosis_text && (
                    <p className="mt-2 text-sm text-gray-700">
                      <span className="font-medium text-gray-900">Diagnosis:</span>{" "}
                      {cert.diagnosis_text}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
          Enter a patient ID above to view their medical certificates.
        </section>
      )}
    </div>
  );
}

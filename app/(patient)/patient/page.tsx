import { getSession } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import FollowUpCard from "@/components/FollowUpCard";
import { redirect } from "next/navigation";

const SI_NUMBER = "09939854927";
const SL_NUMBER = "09942760253";

function supa() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function nameInitials(name: string) {
  const t = name.split(/[,\s]+/).filter(Boolean);
  return (t[0]?.[0] || "") + (t[1]?.[0] || "");
}

export default async function PatientHome() {
  const s = await getSession();
  if (!s || s.role !== "patient") redirect("/login?next=/patient");

  const db = supa();

  const [{ data: lastRes }, { data: lastRx }, { data: pat }] = await Promise.all([
    db
      .from("results_wide")
      .select("date_of_test")
      .eq("patient_id", s.patient_id)
      .order("date_of_test", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("prescriptions")
      .select("created_at")
      .eq("patient_id", s.patient_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("patients")
      .select("full_name")
      .eq("patient_id", s.patient_id)
      .limit(1)
      .maybeSingle(),
  ]);

  const displayName = (pat?.full_name || s.patient_id).trim();
  const lastResultDate = lastRes?.date_of_test
    ? new Date(lastRes.date_of_test as any).toLocaleDateString()
    : "—";
  const lastRxDate = lastRx?.created_at
    ? new Date(lastRx.created_at as any).toLocaleDateString()
    : "—";

  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";
  const initials = nameInitials(displayName).toUpperCase();

  return (
    <main className="min-h-dvh bg-[rgb(248,250,251)]">
      {/* Hero */}
      <section
        className="relative isolate"
        style={{
          background:
            "linear-gradient(135deg, rgba(68,150,155,0.12) 0%, rgba(68,150,155,0.05) 45%, rgba(255,255,255,0.0) 100%)",
        }}
      >
        <div className="mx-auto max-w-4xl px-6 pt-10 pb-8">
          <div className="flex items-start gap-4">
            <div
              className="h-14 w-14 shrink-0 rounded-2xl grid place-items-center text-white text-xl font-semibold shadow-sm"
              style={{ backgroundColor: accent }}
              aria-hidden
            >
              {initials || "P"}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Welcome <span className="text-gray-800">{displayName}</span>
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Your Patient ID: <span className="font-mono">{s.patient_id}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/70 ring-1 ring-gray-200 shadow-sm"
                  title="Most recent result date"
                >
                  <Dot color={accent} />
                  Latest Result: <strong className="ml-1">{lastResultDate}</strong>
                </span>
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/70 ring-1 ring-gray-200 shadow-sm"
                  title="Most recent prescription date"
                >
                  <Dot color={accent} />
                  Last Prescription: <strong className="ml-1">{lastRxDate}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="mx-auto max-w-4xl px-6 pb-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <ActionCard
            href="/results"
            heading="View Results"
            sub="Tingnan ang Results"
            badge={`Latest: ${lastResultDate}`}
            accent={accent}
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            }
          />
          <ActionCard
            href="/prescriptions"
            heading="View Prescriptions"
            sub="Tingnan ang Reseta"
            badge={`Last: ${lastRxDate}`}
            accent={accent}
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                <path d="M9 12h6M9 16h6M9 8h3" />
              </svg>
            }
          />
        </div>

        {/* Extra module (kept from your app) */}
        <div className="mt-4">
          <FollowUpCard />
        </div>

        {/* Footer / Support */}
        <div className="mt-8 grid gap-3 text-sm text-gray-600">
          <div className="inline-flex items-center gap-2">
            <Dot color={accent} />
            Need help? San Isidro:{" "}
            <a className="underline decoration-1 hover:opacity-80" href={`tel:${SI_NUMBER}`}>
              {SI_NUMBER}
            </a>
            <span aria-hidden>•</span>
            San Leonardo:{" "}
            <a className="underline decoration-1 hover:opacity-80" href={`tel:${SL_NUMBER}`}>
              {SL_NUMBER}
            </a>
          </div>

          <form action="/api/auth/logout" method="post" className="pt-1">
            <button
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm hover:bg-gray-50 active:scale-[0.99] transition"
              type="submit"
            >
              Logout
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

/* ---------- UI bits ---------- */

function ActionCard({
  href,
  heading,
  sub,
  badge,
  accent,
  icon,
}: {
  href: string;
  heading: string;
  sub: string;
  badge: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white/80 shadow-sm ring-1 ring-black/0 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
    >
      {/* accent stripe */}
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl text-white"
              style={{ backgroundColor: accent }}
              aria-hidden
            >
              {icon}
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{heading}</h2>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700">
            {badge}
          </span>
        </div>

        <div className="mt-4 text-sm text-gray-600 opacity-90 group-hover:opacity-100">
          Tap to open
        </div>
      </div>
    </Link>
  );
}

function Dot({ color = "#44969b" }: { color?: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

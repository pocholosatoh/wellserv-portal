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
    <main className="min-h-dvh bg-white">
      {/* Hero */}
      <section className="relative isolate px-4 pt-10 pb-8">
        <div className="mx-auto max-w-4xl">
          <div
            className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_25px_60px_rgba(15,23,42,0.12)] backdrop-blur"
            style={{
              background:
                "linear-gradient(135deg, rgba(68,150,155,0.18) 0%, rgba(255,255,255,0.85) 55%, rgba(255,255,255,0.95) 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute -right-16 top-10 h-44 w-44 rounded-full"
              style={{ background: `${accent}1a`, filter: "blur(6px)" }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full opacity-80"
              style={{ background: `${accent}14`, filter: "blur(20px)" }}
              aria-hidden
            />
            <div className="absolute right-4 top-4 z-10 flex items-center justify-center sm:right-6 sm:top-6">
              <img
                src="/logo.png"
                alt="Wellserv Diagnostics"
                className="h-9 w-auto opacity-70 sm:h-10"
                style={{ filter: "drop-shadow(0 6px 12px rgba(15,23,42,0.18))" }}
              />
            </div>
            <div className="flex items-start gap-4 px-6 py-6 sm:px-8 sm:py-7">
              <div
                className="h-14 w-14 shrink-0 rounded-2xl grid place-items-center text-white text-xl font-semibold shadow-md shadow-[rgba(68,150,155,0.35)]"
                style={{ backgroundColor: accent }}
                aria-hidden
              >
                {initials || "P"}
              </div>
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  Patient Portal
                  <span className="hidden sm:inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                  <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-slate-400">
                    your health at a glance
                  </span>
                </p>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[27px]">
                  Welcome back, <span className="text-slate-800">{displayName}</span>
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Patient ID: <span className="font-mono text-[0.95rem] text-slate-800">{s.patient_id}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/80 ring-1 ring-slate-200 shadow-sm"
                    title="Most recent result date"
                  >
                    <Dot color={accent} />
                    Latest Result: <strong className="ml-1 font-semibold text-slate-800">{lastResultDate}</strong>
                  </span>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/80 ring-1 ring-slate-200 shadow-sm"
                    title="Most recent prescription date"
                  >
                    <Dot color={accent} />
                    Last Prescription: <strong className="ml-1 font-semibold text-slate-800">{lastRxDate}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="mx-auto max-w-4xl px-6 pb-10">
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
        <div className="mt-6 overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
          <FollowUpCard />
        </div>

        {/* Footer / Support */}
        <div className="mt-8 grid gap-5 text-sm text-gray-600">
          <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/60 bg-white/80 px-5 py-4 text-slate-600 shadow-sm shadow-slate-200 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-2 text-[0.95rem] font-medium text-slate-700">
              <Dot color={accent} /> Need help? We’re one tap away.
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/60 px-3 py-1 text-slate-600">
                San Isidro:
                <a className="font-semibold text-slate-700 underline decoration-1 underline-offset-2 hover:opacity-80" href={`tel:${SI_NUMBER}`}>
                  {SI_NUMBER}
                </a>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/60 px-3 py-1 text-slate-600">
                San Leonardo:
                <a className="font-semibold text-slate-700 underline decoration-1 underline-offset-2 hover:opacity-80" href={`tel:${SL_NUMBER}`}>
                  {SL_NUMBER}
                </a>
              </span>
            </div>
          </div>

          <form action="/api/auth/logout" method="post" className="pt-1">
            <button
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
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
      className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-black/0 transition hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(15,23,42,0.12)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgba(68,150,155,0.35)]"
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

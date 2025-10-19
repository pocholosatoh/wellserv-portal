import { getSession } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import FollowUpCard from "@/components/FollowUpCard";

const SI_NUMBER = "09939854927";
const SL_NUMBER = "09942760253";

export default async function PatientHome() {
  const s = await getSession();
  if (!s || s.role !== "patient") return null;

  // Keep your env names; add safe fallbacks
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load latest result date
  const { data: lastRes } = await supabase
    .from("results_wide")
    .select("date_of_test")
    .eq("patient_id", s.patient_id)
    .order("date_of_test", { ascending: false })
    .limit(1);

  // Load latest Rx date
  const { data: lastRx } = await supabase
    .from("prescriptions")
    .select("created_at")
    .eq("patient_id", s.patient_id)
    .order("created_at", { ascending: false })
    .limit(1);

  // Fetch patient full name (replaces old s.name)
  const { data: pat } = await supabase
    .from("patients")
    .select("full_name")
    .eq("patient_id", s.patient_id)
    .limit(1);

  const displayName = pat?.[0]?.full_name || s.patient_id;

  const lastResultDate = lastRes?.[0]?.date_of_test
    ? new Date(lastRes[0].date_of_test as any).toLocaleDateString()
    : "—";

  const lastRxDate = lastRx?.[0]?.created_at
    ? new Date(lastRx[0].created_at as any).toLocaleDateString()
    : "—";

  // We no longer keep iat in cookies; just show current time for "Last accessed"
  const lastAccess = new Date().toLocaleString();

  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  return (
    <main className="min-h-dvh p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Welcome {displayName}</h1>
          <p className="text-sm text-gray-500">Choose an option below.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Card
            href="/results"
            title="View Results"
            subtitle="Tingnan ang Results"
            badge={`Latest: ${lastResultDate}`}
            accent={accent}
          />
          <Card
            href="/prescriptions"
            title="View Prescriptions"
            subtitle="Tingnan ang Reseta"
            badge={`Last: ${lastRxDate}`}
            accent={accent}
          />
          <FollowUpCard />
        </section>

        <footer className="mt-8 text-sm text-gray-600">
          <div>Last accessed: {lastAccess}</div>
          <div>
            Need help? Call San Isidro:{" "}
            <a className="underline" href={`tel:${SI_NUMBER}`}>
              {SI_NUMBER}
            </a>{" "}
            | San Leonardo:{" "}
            <a className="underline" href={`tel:${SL_NUMBER}`}>
              {SL_NUMBER}
            </a>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <button className="rounded-lg border px-3 py-2">Logout</button>
          </form>
        </footer>
      </div>
    </main>
  );
}

function Card({
  href,
  title,
  subtitle,
  badge,
  accent,
}: {
  href: string;
  title: string;
  subtitle: string;
  badge: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border shadow-sm p-5 hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{ borderTop: `6px solid ${accent}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <span className="text-xs bg-gray-100 rounded-full px-3 py-1">{badge}</span>
      </div>
      <div className="mt-4 text-sm text-gray-600">Tap to open</div>
    </Link>
  );
}

// File: app/(public)/pricelist/page.tsx
import "server-only";
import Link from "next/link";
import TestsClient, { TestRow } from "@/components/pricing/TestsClient";
import { ClipboardList, Clock4, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

// Supabase via PostgREST (simple + deploy-safe)
// Env names you gave: SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Avoid static generation so build doesn’t need to hit Supabase
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const revalidate = 3600;

export const metadata = {
  title: "WELLSERV — Price List (Packages + Tests)",
  description: "Transparent pricing for lab packages and individual tests.",
};

export type PackageRow = {
  id: string;
  package_code: string;
  display_name: string;
  package_price: number;
};
export type PackageItemRow = {
  package_id: string | null;
  test_id: string | null;
  package_code?: string | null;
  test_code?: string | null;
};
export type CatalogTestRow = {
  id: string;
  test_code: string;
  display_name: string;
  default_price: number;
  is_active: boolean;
};

async function sbFetch<T>(path: string, { select }: { select?: string } = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  const url = new URL(`/rest/v1/${path}`, SUPABASE_URL);
  if (select) url.searchParams.set("select", select);
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    next: { revalidate },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase fetch failed: ${path} • ${res.status} • ${text}`);
  }
  return (await res.json()) as T;
}

type PackageWithItems = PackageRow & {
  items: { code: string; name: string }[];
  isFeatured: boolean;
};

async function getData() {
  const [packages, items, tests] = await Promise.all([
    sbFetch<PackageRow[]>("packages", { select: "*" }),
    sbFetch<PackageItemRow[]>("package_items", { select: "*" }),
    sbFetch<CatalogTestRow[]>("tests_catalog", { select: "*" }),
  ]);

  const testById = new Map<string, CatalogTestRow>(tests.map((t) => [t.id, t]));
  const testByCode = new Map<string, CatalogTestRow>(
    tests.map((t) => [t.test_code.trim().toUpperCase(), t]),
  );
  const packageIdByCode = new Map<string, string>(
    packages.map((p) => [p.package_code.trim().toUpperCase(), p.id]),
  );

  const itemsByPkg = new Map<string, { code: string; name: string }[]>();
  for (const it of items) {
    const test =
      (it.test_id ? testById.get(it.test_id) : undefined) ||
      (it.test_code ? testByCode.get(it.test_code.trim().toUpperCase()) : undefined);
    const pkgId =
      it.package_id ||
      (it.package_code ? packageIdByCode.get(it.package_code.trim().toUpperCase()) : undefined);
    if (!pkgId) continue;
    const arr = itemsByPkg.get(pkgId) ?? [];
    const code = test?.test_code || it.test_code || "";
    arr.push({ code, name: test?.display_name ?? code });
    itemsByPkg.set(pkgId, arr);
  }

  const packagesWithItems: PackageWithItems[] = packages
    .map((p) => ({
      ...p,
      items: (itemsByPkg.get(p.id) || []).sort((a, b) => a.name.localeCompare(b.name)),
      isFeatured: p.package_code === "COMP999" || p.package_code === "DIA1599",
    }))
    .sort(
      (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.package_price - b.package_price,
    );

  const activeTests: TestRow[] = tests
    .filter((t) => t.is_active)
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((t) => ({
      id: t.id,
      test_code: t.test_code,
      display_name: t.display_name,
      default_price: t.default_price,
      is_active: t.is_active,
    }));

  return { packages: packagesWithItems, tests: activeTests };
}

function peso(n: number) {
  return n.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
}

const heroHighlights = [
  {
    icon: ShieldCheck,
    title: "DOH Licensed",
    desc: "Accredited facilities with quality assurance protocols.",
  },
  {
    icon: Clock4,
    title: "Opens 6:30 AM",
    desc: "Perfect for fasting patients who need early draws.",
  },
  {
    icon: ClipboardList,
    title: "Transparent rates",
    desc: "No hidden fees; prices updated straight from our system.",
  },
];

export default async function PriceListPage() {
  const { packages, tests } = await getData();
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[rgb(248,250,251)]"
      style={
        {
          // pass accent to CSS variables for consistent theming
          ["--accent" as any]: accent,
          ["--accent-10" as any]: `${accent}1A`, // ~10% alpha
          ["--accent-33" as any]: `${accent}33`,
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.18),_rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute -right-[20%] top-40 z-0 h-[420px] w-[60%] rounded-full bg-[radial-gradient(circle,_rgba(68,150,155,0.14),_rgba(255,255,255,0))] blur-3xl" />

      <div className="sticky top-0 z-30 border-b border-white/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-white/80 px-3 py-1.5 text-sm text-accent shadow-sm transition hover:bg-accent/10"
          >
            ← Back to Home
          </Link>
          <a
            href="https://m.me/100882935339577"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            Message us
          </a>
        </div>
      </div>

      <div className="relative z-10">
        <section className="mx-auto max-w-6xl space-y-12 px-4 pb-16 pt-10 md:px-6 lg:px-8">
          <header className="relative overflow-hidden rounded-[40px] border border-white/60 bg-white/80 px-6 py-10 shadow-xl backdrop-blur md:px-10 md:py-14">
            <div className="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-12 h-60 w-60 rounded-full bg-emerald-200/40 blur-3xl" />
            <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                  <Sparkles className="h-4 w-4" />
                  Transparent Pricing
                </span>
                <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl md:text-5xl">
                  Affordable laboratory packages and individual tests
                </h1>
                <p className="max-w-xl text-base text-gray-600 md:text-lg">
                  Our rates stay honest and easy to understand. Choose a sulit package or browse
                  individual diagnostics— same trusted care, same-day availability, and results
                  accessible online.
                </p>
              </div>
              <div className="grid w-full max-w-sm gap-4 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg backdrop-blur lg:max-w-xs">
                <p className="text-sm font-semibold text-gray-900">Need a custom quote?</p>
                <p className="text-sm text-gray-600">
                  Message our team for corporate accounts, annual physicals, or mobile collection.
                </p>
                <a
                  href="mailto:wellservmedicalcorp@gmail.com"
                  className="inline-flex items-center justify-center rounded-full border border-accent/40 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
                >
                  Email quotations
                </a>
              </div>
            </div>
            <div className="relative mt-10 grid gap-4 sm:grid-cols-3">
              {heroHighlights.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/80 p-4 text-sm text-gray-600 shadow-md backdrop-blur"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">{title}</div>
                    <p className="text-xs text-gray-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </header>

          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">
                  Featured packages
                </h2>
                <p className="text-sm text-gray-600">
                  Most-requested bundles for annual checkups and baseline lab work.
                </p>
              </div>
              <a href="#individual-tests" className="btn-outline rounded-full px-4 py-2 text-sm">
                Jump to individual tests
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                  {packages
                    .filter((p) => p.isFeatured)
                    .map((p) => (
                      <div
                        key={p.id}
                    className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur transition hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <div className="absolute -top-32 right-0 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-semibold leading-tight text-gray-900">
                            {p.display_name}
                          </h3>
                          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
                            Most Sulit
                          </span>
                        </div>
                        <p className="text-xs font-medium text-gray-500">
                          Hindi kailangan ng reseta • 10–12 hours fasting
                        </p>
                      </div>
                      <div className="text-3xl font-bold text-accent">{peso(p.package_price)}</div>
                    </div>
                    <ul className="relative mt-5 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                      {p.items.map((it) => (
                        <li key={it.name} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-accent/70" />
                          <span className="leading-tight">{it.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">All packages</h2>
              <p className="text-sm text-gray-600">
                Pick the combination you need—pricing already includes lab supplies and results
                portal access.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {packages
                  .filter((p) => !p.isFeatured)
                  .map((p) => (
                    <div
                      key={p.id}
                    className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg backdrop-blur transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold leading-tight text-gray-900">
                          {p.display_name}
                        </h3>
                      </div>
                      <div className="text-xl font-semibold text-accent">
                        {peso(p.package_price)}
                      </div>
                    </div>
                    <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
                      {p.items.map((it) => (
                        <li key={it.name} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
                          <span className="leading-tight">{it.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>

          {/* Individual tests */}
          <div id="individual-tests">
            <TestsClient tests={tests} />
            <p className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-gray-600 shadow-inner backdrop-blur">
              Note: Prices may change without prior notice and some specialty tests may require a
              separate turnaround time. For other lab tests not listed here, please consult with our
              laboratories.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

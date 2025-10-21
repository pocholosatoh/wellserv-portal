// File: app/(public)/pricelist/page.tsx
import 'server-only';
import Link from 'next/link';
import TestsClient, { TestRow } from '@/components/pricing/TestsClient';
import { MessageCircle } from 'lucide-react';

// Supabase via PostgREST (simple + deploy-safe)
// Env names you gave: SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const revalidate = 3600;

export const metadata = {
  title: 'WELLSERV — Price List (Packages + Tests)',
  description: 'Transparent pricing for lab packages and individual tests.',
};

export type PackageRow = {
  package_code: string;
  display_name: string;
  package_price: number;
};
export type PackageItemRow = { package_code: string; test_code: string };
export type CatalogTestRow = {
  test_code: string;
  display_name: string;
  default_price: number;
  is_active: boolean;
};

async function sbFetch<T>(path: string, { select }: { select?: string } = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  const url = new URL(`/rest/v1/${path}`, SUPABASE_URL);
  if (select) url.searchParams.set('select', select);
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
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
    sbFetch<PackageRow[]>('packages', { select: '*' }),
    sbFetch<PackageItemRow[]>('package_items', { select: '*' }),
    sbFetch<CatalogTestRow[]>('tests_catalog', { select: '*' }),
  ]);

  const testByCode = new Map<string, CatalogTestRow>(
    tests.map((t) => [t.test_code.trim(), t])
  );

  const itemsByPkg = new Map<string, { code: string; name: string }[]>();
  for (const it of items) {
    const t = testByCode.get(it.test_code.trim());
    const arr = itemsByPkg.get(it.package_code) ?? [];
    arr.push({ code: it.test_code, name: t?.display_name ?? it.test_code });
    itemsByPkg.set(it.package_code, arr);
  }

  const packagesWithItems: PackageWithItems[] = packages
    .map((p) => ({
      ...p,
      items: (itemsByPkg.get(p.package_code) || []).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      isFeatured: p.package_code === 'COMP999' || p.package_code === 'DIA1599',
    }))
    .sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        a.package_price - b.package_price
    );

  const activeTests: TestRow[] = tests
    .filter((t) => t.is_active)
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((t) => ({
      test_code: t.test_code,
      display_name: t.display_name,
      default_price: t.default_price,
      is_active: t.is_active,
    }));

  return { packages: packagesWithItems, tests: activeTests };
}

function peso(n: number) {
  return n.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  });
}

export default async function PriceListPage() {
  const { packages, tests } = await getData();
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || '#44969b';

  return (
    <main
      className="min-h-dvh"
      style={
        {
          // pass accent to CSS variables for consistent theming
          ['--accent' as any]: accent,
          ['--accent-10' as any]: `${accent}1A`, // ~10% alpha
          ['--accent-33' as any]: `${accent}33`,
        } as React.CSSProperties
      }
    >
      {/* Sticky header with Back + Message */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl p-3">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 px-3 py-2 flex items-center justify-between">
            <Link href="/" className="rounded-xl px-3 py-2 hover:bg-black/5">
              ← Back to Home
            </Link>
            <a
              href="https://m.me/100882935339577"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-white"
              style={{ backgroundColor: accent }}
            >
              <MessageCircle className="h-4 w-4" />
              Message us
            </a>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-5xl p-4 md:p-6 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Price List</h1>
          <p className="text-gray-600">
            Packages first for sulit savings, then individual tests. For questions, message us on Facebook.
          </p>
        </header>

        {/* Featured packages with glow + pill */}
        <div className="grid md:grid-cols-2 gap-3">
          {packages.filter((p) => p.isFeatured).map((p) => (
            <div key={p.package_code} className="glow-card rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold leading-tight">{p.display_name}</h3>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--accent-10)', color: 'var(--accent)' }}
                    >
                      Most Sulit
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Hindi kailangan ng reseta • 10–12 hours fasting
                  </p>
                </div>
                <div className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                  {peso(p.package_price)}
                </div>
              </div>

              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {p.items.map((it) => (
                  <li key={it.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                    <span>{it.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* All packages (floating cards, accent only) */}
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold">Packages</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {packages.filter((p) => !p.isFeatured).map((p) => (
              <div key={p.package_code} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold leading-tight">{p.display_name}</h3>
                    
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                    {peso(p.package_price)}
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                  {p.items.map((it) => (
                    <li key={it.name} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                      <span>{it.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Individual tests */}
        <TestsClient tests={tests} />
      </section>
    </main>
  );
}

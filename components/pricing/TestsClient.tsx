'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';

export type TestRow = {
  test_code: string;
  display_name: string;
  default_price: number;
  is_active: boolean;
};

export default function TestsClient({ tests }: { tests: TestRow[] }) {
  const [q, setQ] = useState('');
  const accent = (typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--accent')?.trim()
    : '') || '#44969b';

  const filtered = useMemo(() => {
    const x = tests.filter((t) =>
      t.display_name.toLowerCase().includes(q.toLowerCase())
    );
    return [...x].sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [tests, q]);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-gray-900">Individual tests</h2>
            <p className="text-sm text-gray-600">
              Search the full catalogue for add-on diagnostics or specific physician requests.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex items-center" aria-label="Search tests">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
              <input
                placeholder="Search test name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-64 rounded-2xl border border-white/70 bg-white/90 px-10 py-2 text-sm text-gray-700 shadow-inner transition focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <p className="text-xs text-gray-500">
              Individual test rates are shared upon request.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <div
            key={t.test_code}
            className="flex items-start justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg backdrop-blur transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="min-w-0 space-y-1">
              <div className="text-base font-medium leading-tight text-gray-900">{t.display_name}</div>
              {/* no code for patient view */}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

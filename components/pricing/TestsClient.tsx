'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export type TestRow = {
  test_code: string;
  display_name: string;
  default_price: number;
  is_active: boolean;
};

function peso(n: number) {
  return n.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  });
}

export default function TestsClient({ tests }: { tests: TestRow[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'name' | 'price'>('name');
  const accent = (typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--accent')?.trim()
    : '') || '#44969b';

  const filtered = useMemo(() => {
    const x = tests.filter((t) =>
      t.display_name.toLowerCase().includes(q.toLowerCase())
    );
    if (sort === 'name') return [...x].sort((a, b) => a.display_name.localeCompare(b.display_name));
    return [...x].sort((a, b) => a.default_price - b.default_price);
  }, [tests, q, sort]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Individual Tests</h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search test name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white shadow-sm ring-1 ring-black/5 w-64"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-white shadow-sm ring-1 ring-black/5"
          >
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((t) => (
          <div
            key={t.test_code}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-base font-medium leading-tight text-gray-900">
                {t.display_name}
              </div>
              {/* no code for patient view */}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <div className="text-xl font-semibold" style={{ color: accent }}>
                {peso(t.default_price)}
              </div>
              <CheckCircle2 className="h-5 w-5" style={{ color: accent }} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Note: Prices subject to change without prior notice. Some specialty tests may require a separate turnaround time.
      </p>
    </div>
  );
}

'use client';
import { useState } from 'react';

type Row = Record<string, string | null>;

export default function Portal() {
  const [patient_id, setPid] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null); setRows(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timer);
      setLoading(false);
      return setErr(err?.name === 'AbortError' ? 'Request timed out.' : 'Network error.');
    }
    clearTimeout(timer);

    let data: any = null, text = '';
    const ct = res.headers.get('content-type') || '';
    try {
      data = ct.includes('application/json') ? await res.json() : null;
      if (!data) text = await res.text();
    } catch { text = await res.text(); }

    setLoading(false);
    if (!res.ok) return setErr((data && data.error) || text || `HTTP ${res.status}`);
    setRows((data.rows || []) as Row[]);
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">View Lab Results</h1>

      <form onSubmit={submit} className="flex gap-2 print:hidden">
        <input
          className="border p-2 flex-1 rounded"
          placeholder="Patient ID (e.g., SATOH010596)"
          value={patient_id}
          onChange={e => setPid(e.target.value)}
        />
        <button className="px-4 py-2 rounded bg-black text-white">
          {loading ? 'Loading…' : 'View'}
        </button>
        {rows && rows.length > 0 && (
          <button type="button" className="px-4 py-2 rounded border" onClick={() => window.print()}>
            Print
          </button>
        )}
      </form>

      {err && <p className="text-red-600">{err}</p>}
      {rows && rows.length === 0 && <p>No records found.</p>}
      {rows && rows.map((r, i) => <ResultCard key={i} row={r} />)}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          main { max-width: 100%; padding: 0; }
        }
      `}</style>
    </main>
  );
}

function ResultCard({ row }: { row: Row }) {
  const sections = groupSections(row);
  return (
    <div className="border rounded p-4 space-y-2 my-2">
      <div className="text-lg font-semibold">{row.full_name}</div>
      <div className="text-sm text-gray-600">
        {row.patient_id} • {row.sex} • {row.age ? `${row.age} yrs` : ''} • DOB {row.birthday}
      </div>
      <div className="text-sm">Date of Test: <b>{row.date_of_test}</b></div>
      {row.notes && <div className="text-sm mt-1">Overall Notes: {row.notes}</div>}

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {sections.map(sec => (
          <div key={sec.title} className="border rounded p-3">
            <div className="font-medium mb-2">{sec.title}</div>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              {sec.items.map(([k, v]) => (
                <FragmentRow key={k} k={k} v={v} />
              ))}
            </dl>
            {sec.notes && <div className="mt-2 text-sm italic">Notes: {sec.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-gray-600">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </>
  );
}

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function groupSections(r: Row) {
  const defs = [
    { prefix: 'hema_', title: 'Hematology', notesKey: 'hema_remarks' },
    { prefix: 'chem_', title: 'Chemistry', notesKey: 'chem_remarks' },
    { prefix: 'ua_',   title: 'Urinalysis', notesKey: 'ua_remarks' },
    { prefix: 'fa_',   title: 'Fecalysis', notesKey: 'fa_remarks' },
    { prefix: 'sero_', title: 'Serology', notesKey: 'sero_remarks' },
  ];
  return defs.map(d => {
    const items: [string,string][] = [];
    for (const [k,v] of Object.entries(r)) {
      if (!k.startsWith(d.prefix) || k === d.notesKey) continue;
      if (v == null || String(v).trim() === '') continue;
      items.push([displayLabel(k, d.prefix), String(v)]);
    }
    const notes = (r[d.notesKey] ?? '') as string;
    return { title: d.title, items, notes: notes || '' };
  }).filter(sec => sec.items.length || sec.notes);
}

function displayLabel(key: string, prefix: string) {
  const short = key.slice(prefix.length);
  const map: Record<string,string> = {
    wbc: 'WBC', rbc: 'RBC', hgb: 'Hgb', hct: 'Hct', mcv: 'MCV', mch: 'MCH', mchc: 'MCHC',
    plt: 'Platelets', sg: 'Specific Gravity', ph: 'pH', le: 'Leukocyte Esterase',
    glu: 'Glucose', pro: 'Protein', alt: 'ALT', ast: 'AST', hba1c: 'HbA1c',
  };
  return map[short] ?? titleCase(short);
}

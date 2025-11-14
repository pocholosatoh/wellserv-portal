"use client";

import { useEffect, useMemo, useState } from "react";

type Dx = { id: string; code: string; title: string; is_primary: boolean; created_at: string };

export default function DiagnosisCard({
  consultationId,
}: {
  consultationId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ code: string; title: string }[]>([]);
  const [picks, setPicks] = useState<Dx[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canEdit = Boolean(consultationId);

  async function refresh() {
    if (!consultationId) return;
    const u = new URL("/api/consultations/diagnoses/list", window.location.origin);
    u.searchParams.set("consultation_id", consultationId);
    const r = await fetch(u.toString(), { cache: "no-store" });
    const j = await r.json();
    if (r.ok && !j.error) setPicks(j.items || []);
  }

  useEffect(() => {
    setPicks([]);
    void refresh();
  }, [consultationId]);

  // Search
  useEffect(() => {
    let gone = false;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const u = new URL("/api/icd10/search", window.location.origin);
        u.searchParams.set("q", query.trim());
        const r = await fetch(u.toString(), { cache: "no-store" });
        const j = await r.json();
        if (!gone) setResults(r.ok && !j.error ? j.items || [] : []);
      } catch {
        if (!gone) setResults([]);
      }
    }, 250);
    return () => {
      gone = true;
      clearTimeout(t);
    };
  }, [query]);

  async function add(code: string, title: string, makePrimary = false) {
    if (!consultationId) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/consultations/diagnoses/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consultation_id: consultationId, code, title, make_primary: makePrimary }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j?.error || `HTTP ${r.status}`);
      setQuery("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to add diagnosis.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(code: string) {
    if (!consultationId) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/consultations/diagnoses/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consultation_id: consultationId, code }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j?.error || `HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to remove diagnosis.");
    } finally {
      setBusy(false);
    }
  }

  const primary = useMemo(() => picks.find(p => p.is_primary)?.code || "", [picks]);

  return (
    <section className="rounded-xl border border-gray-200">
      <header className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-medium text-gray-800">Diagnoses (ICD-10)</h3>
      </header>

      <div className="p-4 space-y-4">
        {!canEdit ? (
          <div className="text-sm text-gray-600">
            Start the consultation to add diagnoses.
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ICD-10 (code or title)…"
                className="flex-1 border rounded px-3 py-2 text-sm"
                disabled={busy}
              />
            </div>

            {results.length > 0 && (
              <div className="rounded border bg-white max-h-56 overflow-auto">
                {results.map((r) => (
                  <div key={r.code} className="flex items-start gap-2 px-3 py-2 border-t first:border-t-0">
                    <div className="w-24 font-mono text-xs text-gray-700">{r.code}</div>
                    <div className="flex-1 text-sm">{r.title}</div>
                    <div className="flex gap-2">
                      <button
                        className="text-xs rounded border px-2 py-1"
                        onClick={() => add(r.code, r.title, false)}
                        disabled={busy}
                      >
                        Add
                      </button>
                      <button
                        className="text-xs rounded border px-2 py-1"
                        onClick={() => add(r.code, r.title, true)}
                        disabled={busy}
                      >
                        Add as Primary
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {picks.map((d) => (
                <div key={d.id} className="flex items-start gap-3 rounded border px-3 py-2 bg-white">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="primary_dx"
                      checked={d.code === primary}
                      onChange={() => add(d.code, d.title, true)}
                      disabled={busy}
                    />
                    <span className="font-mono text-gray-700">{d.code}</span>
                  </label>
                  <div className="flex-1 text-sm">{d.title}</div>
                  <button className="text-xs rounded border px-2 py-1" onClick={() => remove(d.code)} disabled={busy}>
                    Remove
                  </button>
                </div>
              ))}
              {picks.length === 0 && (
                <div className="text-sm text-gray-600">No diagnoses yet.</div>
              )}
            </div>

            {err && <div className="text-sm text-red-600">{err}</div>}
          </>
        )}
      </div>
    </section>
  );
}

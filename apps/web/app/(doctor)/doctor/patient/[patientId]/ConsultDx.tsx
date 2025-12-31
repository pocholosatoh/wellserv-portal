"use client";

import { useEffect, useState } from "react";

type Dx = { id: string; code: string; title: string; is_primary: boolean };

export default function ConsultDx({ consultationId }: { consultationId: string }) {
  const [rows, setRows] = useState<Dx[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    async function load() {
      try {
        setErr(null);
        const u = new URL("/api/consultations/diagnoses/list", window.location.origin);
        u.searchParams.set("consultation_id", consultationId);
        const r = await fetch(u.toString(), { cache: "no-store" });
        const j = await r.json();
        if (!dead) {
          if (!r.ok || j.error) throw new Error(j?.error || `HTTP ${r.status}`);
          setRows(j.items || []);
        }
      } catch (e: any) {
        if (!dead) setErr(e?.message || "Failed to load diagnoses");
      }
    }
    load();
    return () => {
      dead = true;
    };
  }, [consultationId]);

  if (err) return <div className="text-sm text-red-600">Diagnoses: {err}</div>;
  if (!rows.length) return null;

  return (
    <div className="mt-3 text-sm">
      <div className="font-medium text-gray-800">Diagnoses</div>
      <ul className="mt-1 space-y-1">
        {rows.map((d) => (
          <li key={d.id} className="flex items-start gap-2">
            <span className="font-mono text-xs text-gray-700">{d.code}</span>
            <span className="flex-1">{d.title}</span>
            {d.is_primary && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Primary
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

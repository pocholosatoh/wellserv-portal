"use client";

import { useEffect, useMemo, useState } from "react";

type Test = { code: string; name: string; price?: number | null };
type Pack = { code: string; name: string; price?: number | null };
type WindowWithLabPackageMap = Window & {
  __labPackageMap?: Record<string, string[]>;
};

type Props = {
  value: string; // comma-separated tokens
  onChange: (next: string) => void;
};

export default function TestPicker({ value, onChange }: Props) {
  const [q, setQ] = useState("");
  const [tests, setTests] = useState<Test[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/catalog/lab");
        const j = await res.json();
        if (res.ok) {
          setTests((j.tests || []).filter((t: any) => t.code && t.name));
          setPacks((j.packages || []).filter((p: any) => p.code && p.name));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tokens = useMemo(
    () =>
      (value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );

  function setTokens(next: string[]) {
    onChange(next.join(", "));
  }
  function addToken(token: string) {
    const set = new Set(tokens);
    set.add(token);
    setTokens(Array.from(set));
    setQ("");
  }
  function removeToken(t: string) {
    setTokens(tokens.filter((x) => x !== t));
  }

  const filteredTests = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return tests
      .filter((t) => t.code.toLowerCase().includes(qq) || t.name.toLowerCase().includes(qq))
      .slice(0, 8);
  }, [q, tests]);

  const filteredPacks = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return packs
      .filter((p) => p.code.toLowerCase().includes(qq) || p.name.toLowerCase().includes(qq))
      .slice(0, 6);
  }, [q, packs]);

  // …inside TestPicker component, after `const tokens = …` and before the return:
  const coverageHints = (() => {
    // Show which tokens are covered by any selected package
    const toks = (value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const chosenUpper = new Set(toks.map((t) => t.toUpperCase()));

    // Build quick maps
    const packCodes = new Set((packs || []).map((p) => p.code.toUpperCase()));
    const covered = new Set<string>();

    // If you loaded packageMap from /api/catalog/lab, thread it via props
    // If not available in this file, skip hints silently.
    const pm: Record<string, string[]> | undefined =
      typeof window !== "undefined" &&
      typeof (window as WindowWithLabPackageMap).__labPackageMap === "object"
        ? (window as WindowWithLabPackageMap).__labPackageMap
        : undefined;

    if (!pm) return [] as string[];

    for (const tok of chosenUpper) {
      if (packCodes.has(tok)) {
        const members = pm[tok];
        if (members) members.forEach((m) => covered.add(m.toUpperCase()));
      }
    }

    // list tests that are covered & also present in tokens
    const duplicates = toks.filter((t) => covered.has(t.toUpperCase()));
    return Array.from(new Set(duplicates));
  })();

  return (
    <div className="space-y-2">
      {/* CSV field (manual edit + shows current value) */}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-2 py-2 w-full"
        placeholder="CSV of test codes or package codes (e.g., CBC, FBS, COMP)"
      />

      {/* tokens */}
      {!!tokens.length && (
        <div className="flex flex-wrap gap-2">
          {tokens.map((t) => (
            <span key={t} className="pill-accent flex items-center gap-1">
              {t}
              <button type="button" onClick={() => removeToken(t)} aria-label="remove">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* search box */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="border rounded px-2 py-2 w-full"
        placeholder={loading ? "Loading catalog…" : "Type code or name to add…"}
      />

      {/* suggestions */}
      {!!q && (
        <div className="border rounded p-2 space-y-1 bg-white shadow-sm max-h-72 overflow-auto">
          {filteredPacks.length > 0 && (
            <>
              <div className="text-xs text-gray-500 px-1">Packages</div>
              {filteredPacks.map((p) => (
                <button
                  key={"P:" + p.code}
                  type="button"
                  onClick={() => addToken(p.code)} // store package_code
                  className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded"
                  title={p.name}
                >
                  {p.code} — {p.name} <span className="text-xs text-gray-500">(package)</span>
                </button>
              ))}
            </>
          )}
          {filteredTests.length > 0 && (
            <>
              <div className="text-xs text-gray-500 px-1 mt-1">Tests</div>
              {filteredTests.map((t) => (
                <button
                  key={"T:" + t.code}
                  type="button"
                  onClick={() => addToken(t.code)} // store test_code
                  className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded"
                  title={t.name}
                >
                  {t.code} — {t.name}
                </button>
              ))}
            </>
          )}
          {!!coverageHints.length && (
            <div className="text-xs text-amber-700">
              {coverageHints.map((t) => (
                <span key={t} className="pill-accent mr-2">
                  Covered by package: {t}
                </span>
              ))}
            </div>
          )}
          {filteredPacks.length === 0 && filteredTests.length === 0 && (
            <div className="px-2 py-1 text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}

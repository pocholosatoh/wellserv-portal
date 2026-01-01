"use client";

import { useEffect, useMemo, useState } from "react";

type Test = { id: string; code: string; name: string; price?: number | null };
type Pack = { id: string; code: string; name: string; price?: number | null };
type Selection = { packageIds: string[]; testIds: string[] };

type Props = {
  value: string; // comma-separated tokens
  onChange: (next: string) => void;
  onSelectionChange?: (next: Selection) => void;
};

export default function TestPicker({ value, onChange, onSelectionChange }: Props) {
  const [q, setQ] = useState("");
  const [tests, setTests] = useState<Test[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [packageMapById, setPackageMapById] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/catalog/lab");
        const j = await res.json();
        if (res.ok) {
          setTests((j.tests || []).filter((t: any) => t.id && t.code && t.name));
          setPacks((j.packages || []).filter((p: any) => p.id && p.code && p.name));
          if (j.packageMapById && typeof j.packageMapById === "object") {
            setPackageMapById(j.packageMapById);
          }
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

  const packageIdByCode = useMemo(() => {
    const map = new Map<string, string>();
    packs.forEach((p) => map.set(p.code.toUpperCase(), p.id));
    return map;
  }, [packs]);

  const packageIdByName = useMemo(() => {
    const map = new Map<string, string>();
    packs.forEach((p) => map.set(p.name.toUpperCase(), p.id));
    return map;
  }, [packs]);

  const testIdByCode = useMemo(() => {
    const map = new Map<string, string>();
    tests.forEach((t) => map.set(t.code.toUpperCase(), t.id));
    return map;
  }, [tests]);

  const testCodeById = useMemo(() => {
    const map = new Map<string, string>();
    tests.forEach((t) => map.set(t.id, t.code));
    return map;
  }, [tests]);

  const selection = useMemo<Selection>(() => {
    const packageIds = new Set<string>();
    const testIds = new Set<string>();
    tokens.forEach((t) => {
      const key = t.toUpperCase();
      const pkgId = packageIdByCode.get(key) || packageIdByName.get(key);
      if (pkgId) {
        packageIds.add(pkgId);
        return;
      }
      const testId = testIdByCode.get(key);
      if (testId) testIds.add(testId);
    });
    return { packageIds: Array.from(packageIds), testIds: Array.from(testIds) };
  }, [tokens, packageIdByCode, packageIdByName, testIdByCode]);

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [selection, onSelectionChange]);

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
    if (!tokens.length) return [] as string[];
    const coveredTestIds = new Set<string>();
    const packageIds = tokens
      .map((t) => {
        const key = t.toUpperCase();
        return packageIdByCode.get(key) || packageIdByName.get(key);
      })
      .filter(Boolean) as string[];

    for (const pkgId of packageIds) {
      const members = packageMapById[pkgId];
      if (members) members.forEach((m) => coveredTestIds.add(m));
    }

    if (!coveredTestIds.size) return [] as string[];

    const coveredCodes = new Set<string>();
    coveredTestIds.forEach((id) => {
      const code = testCodeById.get(id);
      if (code) coveredCodes.add(code.toUpperCase());
    });

    const duplicates = tokens.filter((t) => coveredCodes.has(t.toUpperCase()));
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
                  key={"P:" + p.id}
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
                  key={"T:" + t.id}
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

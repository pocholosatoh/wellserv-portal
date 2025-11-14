"use client";

import { useEffect, useMemo, useState } from "react";

type LabTest = {
  code: string;
  name: string;
  price?: number | null;
};

type LabPackage = {
  code: string;
  name: string;
  price?: number | null;
};

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export default function LabTestQuickSearch({ value, onChange }: Props) {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [packages, setPackages] = useState<LabPackage[]>([]);
  const [packageMap, setPackageMap] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/catalog/lab");
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to load lab catalog");
        }
        if (!cancelled) {
          const items: LabTest[] = (data.tests || []).filter((t: any) => t.code && t.name);
          setTests(items);
          const pkgs: LabPackage[] = (data.packages || []).filter((p: any) => p.code && p.name);
          setPackages(pkgs);
          if (data.packageMap && typeof data.packageMap === "object") {
            setPackageMap(data.packageMap);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load lab catalog");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tokens = useMemo(
    () =>
      (value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [value]
  );

  const filteredTests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return tests
      .filter(
        (t) =>
          t.code.toLowerCase().includes(needle) ||
          t.name.toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [query, tests]);

  const filteredPackages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return packages
      .filter(
        (p) =>
          p.code.toLowerCase().includes(needle) ||
          p.name.toLowerCase().includes(needle)
      )
      .slice(0, 6);
  }, [query, packages]);

  const coverageHints = useMemo(() => {
    if (!tokens.length) return [];
    const covered = new Set<string>();
    tokens.forEach((token) => {
      const members = packageMap[token.toUpperCase()];
      if (members) {
        members.forEach((m) => covered.add(String(m).toUpperCase()));
      }
    });
    if (!covered.size) return [];
    return tokens.filter((token) => covered.has(token.toUpperCase()));
  }, [tokens, packageMap]);

  function setTokens(next: string[]) {
    onChange(next.join(", "));
  }

  function addToken(code: string) {
    if (!code) return;
    const set = new Set(tokens);
    set.add(code);
    setTokens(Array.from(set));
    setQuery("");
  }

  function removeToken(code: string) {
    setTokens(tokens.filter((t) => t !== code));
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-600 mb-1">
        Expected tests / bring-backs
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1 text-sm"
        placeholder="CSV of test codes or free text"
      />
      {!!tokens.length && (
        <div className="flex flex-wrap gap-2">
          {tokens.map((token) => (
            <span key={token} className="pill-accent flex items-center gap-1 text-xs">
              {token}
              <button
                type="button"
                onClick={() => removeToken(token)}
                aria-label={`Remove ${token}`}
                className="text-gray-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder={
            loading ? "Loading tests…" : "Type to search lab catalog (e.g., CBC)"
          }
          disabled={loading}
        />
        {!!query && (
          <div className="border rounded mt-1 max-h-72 overflow-auto bg-white shadow-sm divide-y">
            {filteredPackages.length === 0 && filteredTests.length === 0 && (
              <div className="px-2 py-2 text-sm text-gray-500">No matches</div>
            )}

            {filteredPackages.length > 0 && (
              <div className="py-1">
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Packages
                </div>
                {filteredPackages.map((pkg) => {
                  const members = packageMap[pkg.code.toUpperCase()] || [];
                  const preview = members.slice(0, 4).join(", ");
                  return (
                    <button
                      key={`pkg-${pkg.code}`}
                      type="button"
                      onClick={() => addToken(pkg.code)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs text-gray-600">{pkg.code}</span>
                        <span>{pkg.name}</span>
                        {pkg.price ? (
                          <span className="text-xs text-gray-500">
                            ₱{Number(pkg.price).toLocaleString()}
                          </span>
                        ) : null}
                        <span className="text-[11px] uppercase text-gray-400">package</span>
                      </div>
                      {preview && (
                        <div className="mt-1 text-[11px] text-gray-500">
                          Includes: {preview}
                          {members.length > 4 ? ` +${members.length - 4} more` : ""}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredTests.length > 0 && (
              <div className="py-1">
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Tests
                </div>
                {filteredTests.map((test) => (
                  <button
                    key={`test-${test.code}`}
                    type="button"
                    onClick={() => addToken(test.code)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="font-mono text-xs text-gray-600">{test.code}</span>
                    <span className="ml-2">{test.name}</span>
                    {test.price ? (
                      <span className="ml-2 text-gray-500 text-xs">
                        ₱{Number(test.price).toLocaleString()}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}

            {!!coverageHints.length && (
              <div className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50/70">
                Covered by selected packages:{" "}
                {coverageHints.map((tok) => (
                  <span key={tok} className="mr-2 font-mono">{tok}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </div>
    </div>
  );
}

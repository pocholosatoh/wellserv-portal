export type LabTestRow = {
  id: string;
  test_code: string;
  display_name?: string | null;
  default_price?: number | null;
  is_active?: boolean | null;
};

export type LabPackageRow = {
  id: string;
  package_code: string;
  display_name?: string | null;
  package_price?: number | null;
};

export type LabPackageItemRow = {
  package_id: string | null;
  test_id: string | null;
  package_code?: string | null;
  test_code?: string | null;
};

export type LabCatalogIndex = {
  testById: Map<string, LabTestRow>;
  packageById: Map<string, LabPackageRow>;
  testIdByCode: Map<string, string>;
  packageIdByCode: Map<string, string>;
  packageIdsByName: Map<string, string[]>;
  testCodeById: Map<string, string>;
  packageCodeById: Map<string, string>;
  packageItemsByPackageId: Map<string, string[]>;
};

export type TokenMatch = {
  token: string;
  normalized: string;
  kind: "package" | "test" | "unknown";
  id?: string;
  source?: "code" | "name";
};

export type TokenResolution = {
  matches: TokenMatch[];
  packageIds: string[];
  testIds: string[];
  errors: string[];
};

export type IdCodeMismatch = {
  kind: "package" | "test";
  missingCodes: string[];
  missingIds: string[];
};

export function normalizeCode(value?: string | null): string {
  return (value || "").trim().toUpperCase();
}

export function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function buildLabCatalogIndex(
  tests: LabTestRow[],
  packages: LabPackageRow[],
  packageItems: LabPackageItemRow[],
): LabCatalogIndex {
  const testById = new Map<string, LabTestRow>();
  const packageById = new Map<string, LabPackageRow>();
  const testIdByCode = new Map<string, string>();
  const packageIdByCode = new Map<string, string>();
  const packageIdsByName = new Map<string, string[]>();
  const testCodeById = new Map<string, string>();
  const packageCodeById = new Map<string, string>();
  const packageItemsByPackageId = new Map<string, string[]>();

  for (const t of tests || []) {
    if (!t?.id) continue;
    testById.set(t.id, t);
    const code = normalizeCode(t.test_code);
    if (code && !testIdByCode.has(code)) testIdByCode.set(code, t.id);
    if (t.test_code) testCodeById.set(t.id, t.test_code);
  }

  for (const p of packages || []) {
    if (!p?.id) continue;
    packageById.set(p.id, p);
    const code = normalizeCode(p.package_code);
    if (code && !packageIdByCode.has(code)) packageIdByCode.set(code, p.id);
    if (p.package_code) packageCodeById.set(p.id, p.package_code);
    const nameKey = normalizeCode(p.display_name);
    if (nameKey) {
      const arr = packageIdsByName.get(nameKey) || [];
      arr.push(p.id);
      packageIdsByName.set(nameKey, arr);
    }
  }

  for (const it of packageItems || []) {
    if (!it?.package_id || !it?.test_id) continue;
    const arr = packageItemsByPackageId.get(it.package_id) || [];
    arr.push(it.test_id);
    packageItemsByPackageId.set(it.package_id, arr);
  }

  return {
    testById,
    packageById,
    testIdByCode,
    packageIdByCode,
    packageIdsByName,
    testCodeById,
    packageCodeById,
    packageItemsByPackageId,
  };
}

export function resolveTokens(
  tokens: string[],
  index: LabCatalogIndex,
  opts?: { allowNameFallback?: boolean },
): TokenResolution {
  const matches: TokenMatch[] = [];
  const packageIds = new Set<string>();
  const testIds = new Set<string>();
  const errors: string[] = [];

  for (const token of tokens) {
    const normalized = normalizeCode(token);
    if (!normalized) continue;
    const pkgId = index.packageIdByCode.get(normalized);
    if (pkgId) {
      matches.push({ token, normalized, kind: "package", id: pkgId, source: "code" });
      packageIds.add(pkgId);
      continue;
    }
    const testId = index.testIdByCode.get(normalized);
    if (testId) {
      matches.push({ token, normalized, kind: "test", id: testId, source: "code" });
      testIds.add(testId);
      continue;
    }
    if (opts?.allowNameFallback) {
      const nameIds = index.packageIdsByName.get(normalized) || [];
      if (nameIds.length === 1) {
        matches.push({ token, normalized, kind: "package", id: nameIds[0], source: "name" });
        packageIds.add(nameIds[0]);
        continue;
      }
      if (nameIds.length > 1) {
        errors.push(`Package name "${token}" is ambiguous (${nameIds.length} matches).`);
      }
    }
    matches.push({ token, normalized, kind: "unknown" });
  }

  return {
    matches,
    packageIds: Array.from(packageIds),
    testIds: Array.from(testIds),
    errors,
  };
}

export function expandTokensByPackageIds(matches: TokenMatch[], index: LabCatalogIndex): string[] {
  const expanded: string[] = [];

  for (const match of matches) {
    if (match.kind === "package" && match.id) {
      const members = index.packageItemsByPackageId.get(match.id) || [];
      let pushed = false;
      for (const testId of members) {
        const code = index.testCodeById.get(testId);
        if (code) {
          expanded.push(code);
          pushed = true;
        }
      }
      if (pushed) continue;
    }
    expanded.push(match.token);
  }

  return expanded;
}

export function findIdCodeMismatch(
  tokens: string[],
  inputPackageIds: string[],
  inputTestIds: string[],
  index: LabCatalogIndex,
): IdCodeMismatch | null {
  const tokenCodes = new Set(tokens.map(normalizeCode).filter(Boolean));
  const tokenPackageIds = new Set<string>();
  const tokenTestIds = new Set<string>();

  for (const code of tokenCodes) {
    const packageId = index.packageIdByCode.get(code);
    if (packageId) {
      tokenPackageIds.add(packageId);
      continue;
    }
    const testId = index.testIdByCode.get(code);
    if (testId) tokenTestIds.add(testId);
  }

  if (inputPackageIds.length && tokenPackageIds.size > 0) {
    const inputSet = new Set(inputPackageIds);
    const missingIds = Array.from(tokenPackageIds)
      .filter((id) => !inputSet.has(id))
      .map((id) => index.packageCodeById.get(id) || id);
    const missingCodes = Array.from(inputSet)
      .map((id) => index.packageCodeById.get(id))
      .filter((code): code is string => !!code)
      .filter((code) => !tokenCodes.has(normalizeCode(code)));
    if (missingIds.length || missingCodes.length) {
      return { kind: "package", missingCodes, missingIds };
    }
  }

  if (inputTestIds.length && tokenTestIds.size > 0) {
    const inputSet = new Set(inputTestIds);
    const missingIds = Array.from(tokenTestIds)
      .filter((id) => !inputSet.has(id))
      .map((id) => index.testCodeById.get(id) || id);
    const missingCodes = Array.from(inputSet)
      .map((id) => index.testCodeById.get(id))
      .filter((code): code is string => !!code)
      .filter((code) => !tokenCodes.has(normalizeCode(code)));
    if (missingIds.length || missingCodes.length) {
      return { kind: "test", missingCodes, missingIds };
    }
  }

  return null;
}

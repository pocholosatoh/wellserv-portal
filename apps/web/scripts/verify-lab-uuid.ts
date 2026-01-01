import assert from "node:assert/strict";
import {
  buildLabCatalogIndex,
  expandTokensByPackageIds,
  findIdCodeMismatch,
  resolveTokens,
} from "../lib/labSelection";

function run() {
  const tests = [
    { id: "t1", test_code: "CBC", display_name: "CBC", default_price: 100, is_active: true },
    { id: "t2", test_code: "FBS", display_name: "FBS", default_price: 80, is_active: true },
  ];
  const packages = [
    {
      id: "p1",
      package_code: "COMP999",
      display_name: "Complete Package",
      package_price: 999,
    },
  ];
  const items = [
    { package_id: "p1", test_id: "t1" },
    { package_id: "p1", test_id: "t2" },
  ];

  const index = buildLabCatalogIndex(tests, packages, items);

  // 1) Package expansion uses UUID joins.
  const pkgResolution = resolveTokens(["COMP999"], index, { allowNameFallback: true });
  assert.deepEqual(pkgResolution.packageIds, ["p1"]);
  const expanded = expandTokensByPackageIds(pkgResolution.matches, index);
  assert.deepEqual(expanded, ["CBC", "FBS"]);

  // 2) Quick add by code resolves id then adds (same lookup used by pickers).
  const testResolution = resolveTokens(["FBS"], index, { allowNameFallback: true });
  assert.deepEqual(testResolution.testIds, ["t2"]);

  // 3) Mismatched id+code is detected.
  const mismatch = findIdCodeMismatch(["COMP999"], ["p2"], [], index);
  assert(mismatch && mismatch.kind === "package");

  console.log("verify-lab-uuid: ok");
}

run();

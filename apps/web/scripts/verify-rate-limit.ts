import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRateLimit, getRateLimiterBackend } from "../lib/auth/rateLimit";

const LIMIT = 2;
const WINDOW_MS = 60_000;

function resolveTsxBin() {
  const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const candidates = [
    path.join(process.cwd(), "node_modules", ".bin", binName),
    path.join(process.cwd(), "..", "node_modules", ".bin", binName),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return binName;
}

async function runChild() {
  const key = process.env.RATE_LIMIT_TEST_KEY;
  if (!key) {
    console.error("verify-rate-limit: missing RATE_LIMIT_TEST_KEY");
    process.exit(1);
  }
  const result = await checkRateLimit({ key, limit: LIMIT, windowMs: WINDOW_MS });
  process.stdout.write(JSON.stringify(result));
}

async function runParent() {
  const backend = await getRateLimiterBackend();
  if (backend === "memory") {
    console.log("verify-rate-limit: skipped (memory backend)");
    return;
  }

  const key = `verify-rate-limit:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const scriptPath = fileURLToPath(import.meta.url);
  const tsxBin = resolveTsxBin();
  const env = { ...process.env, RATE_LIMIT_TEST_KEY: key };

  const first = spawnSync(tsxBin, [scriptPath, "--child"], {
    env,
    encoding: "utf8",
  });
  if (first.status !== 0) {
    console.error("verify-rate-limit: child 1 failed", first.stderr || first.stdout);
    process.exit(first.status ?? 1);
  }

  const second = spawnSync(tsxBin, [scriptPath, "--child"], {
    env,
    encoding: "utf8",
  });
  if (second.status !== 0) {
    console.error("verify-rate-limit: child 2 failed", second.stderr || second.stdout);
    process.exit(second.status ?? 1);
  }

  const firstResult = JSON.parse(first.stdout.trim() || "{}");
  const secondResult = JSON.parse(second.stdout.trim() || "{}");

  assert.equal(firstResult.ok, true);
  assert.equal(secondResult.ok, true);
  assert.equal(firstResult.remaining, 1);
  assert.equal(secondResult.remaining, 0);

  console.log(`verify-rate-limit: ok (${backend})`);
}

const isChild = process.argv.includes("--child");

if (isChild) {
  runChild().catch((err) => {
    console.error("verify-rate-limit: child error", err);
    process.exit(1);
  });
} else {
  runParent().catch((err) => {
    console.error("verify-rate-limit: error", err);
    process.exit(1);
  });
}

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");

  // Guardrail: PHI must be accessed via server APIs only; client-side Supabase PHI queries are prohibited.

  const ROOT = path.resolve(__dirname, "..");
  const TARGET_DIRS = [
    path.join(ROOT, "apps", "mobile"),
    path.join(ROOT, "packages", "data", "src", "hooks"),
  ];
  const TABLES = [
    "patients",
    "results_wide",
    "prescriptions",
    "prescription_items",
    "encounters",
    "consultations",
    "followups",
    "vitals",
    "diagnoses",
    "ecg",
    "medical_certificates",
    "consents",
  ];
  const PATTERN_SOURCE = `\\bsupabase\\s*(?:\\?\\.|\\.)\\s*from\\(\\s*(['"\`])(${TABLES.join("|")})\\1\\s*\\)`;
  const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
  const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage"]);

  function walkDir(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walkDir(path.join(dir, entry.name), out);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name);
      if (!EXTENSIONS.has(ext)) continue;
      out.push(path.join(dir, entry.name));
    }
    return out;
  }

  function findMatches(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const regex = new RegExp(PATTERN_SOURCE, "g");
    const matches = [];
    let match;
    while ((match = regex.exec(content))) {
      const line = content.slice(0, match.index).split("\n").length;
      matches.push({ filePath, line, snippet: match[0] });
    }
    return matches;
  }

  const findings = [];
  for (const dir of TARGET_DIRS) {
    const files = walkDir(dir);
    for (const file of files) {
      findings.push(...findMatches(file));
    }
  }

  if (findings.length > 0) {
    console.error("Found client-side PHI table queries in mobile/shared code:");
    for (const finding of findings) {
      const relPath = path.relative(ROOT, finding.filePath);
      console.error(`- ${relPath}:${finding.line} ${finding.snippet}`);
    }
    process.exitCode = 1;
  } else {
    console.log("No client-side PHI table queries found in mobile/shared code.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

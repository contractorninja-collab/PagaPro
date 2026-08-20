/**
 * Design-drift ratchet: raw hex in feature code may only ever go DOWN.
 *
 * The design system's colors live in tailwind.config.ts (ink/line/fill/tone/
 * brand). Feature code should use those tokens; every raw `#rrggbb` written
 * into a tsx class string is drift. This script counts hex literals per file
 * and fails the lint run when any file exceeds its recorded baseline or a new
 * file introduces hex at all.
 *
 * Chart fills, PDF builders and brand assets legitimately hold hex — they are
 * allowlisted (never counted) because their colors are output artifacts, not
 * UI classes.
 *
 * Usage: node scripts/check-design-drift.cjs [--update-baseline]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASELINE_PATH = path.join(__dirname, "design-drift-baseline.json");
const HEX_RE = /#[0-9a-fA-F]{6}\b/g;

/** Colors here are output artifacts (SVG/PDF/print/brand), not UI drift. */
const ALLOWLIST = [
  "src/components/branding/",
  "src/modules/payroll/pdf/",
  "src/modules/documents/print/",
  "src/modules/reports/components/charts/",
  "src/modules/reports/components/raportet-charts-client.tsx",
  "src/components/patterns/chart-frame.tsx",
  "src/modules/dashboard/widgets/dashboard-trend-card.tsx",
  "src/modules/leaves/wallchart/leave-wallchart.tsx",
];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

const counts = {};
let total = 0;
for (const file of walk(path.join(ROOT, "src"), [])) {
  const r = rel(file);
  if (ALLOWLIST.some((a) => r.startsWith(a))) continue;
  const matches = fs.readFileSync(file, "utf8").match(HEX_RE);
  if (matches && matches.length > 0) {
    counts[r] = matches.length;
    total += matches.length;
  }
}

if (process.argv.includes("--update-baseline")) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + "\n");
  console.log(`[design-drift] baseline written: ${Object.keys(counts).length} files, ${total} hex literals`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error("[design-drift] no baseline — run: node scripts/check-design-drift.cjs --update-baseline");
  process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));

const offenders = [];
for (const [file, count] of Object.entries(counts)) {
  const allowed = baseline[file] ?? 0;
  if (count > allowed) offenders.push(`${file}: ${count} hex (baseline ${allowed})`);
}

if (offenders.length > 0) {
  console.error("[design-drift] raw hex increased — use the tokens in tailwind.config.ts (ink/line/fill/tone/brand):");
  for (const o of offenders) console.error("  " + o);
  console.error("[design-drift] if a color genuinely cannot be a token (chart/PDF), extend the ALLOWLIST instead.");
  process.exit(1);
}

const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
if (total < baselineTotal) {
  console.log(
    `[design-drift] ok — ${total} hex literals (baseline ${baselineTotal}; run --update-baseline to ratchet down)`,
  );
} else {
  console.log(`[design-drift] ok — ${total} hex literals`);
}

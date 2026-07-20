/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Guarded replacement for a bare `prisma migrate deploy`.
 *
 * Applies pending migrations only when it is safe to do so — see
 * scripts/lib/deploy-guard.cjs for the invariant and why it exists.
 */
// Local runs read DATABASE_URL from .env, exactly as prisma.config.ts does.
// On Vercel these are already real environment variables and this is a no-op.
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const {
  resolveConnectionString,
  describeDeployTarget,
  evaluateSchemaChange,
  formatTarget,
} = require("./lib/deploy-guard.cjs");

/**
 * Statements that destroy data or break older running code. Deliberately
 * conservative: a false positive costs one env var, a false negative costs an outage.
 */
const DESTRUCTIVE_PATTERNS = [
  { label: "DROP TABLE", re: /\bDROP\s+TABLE\b/i },
  { label: "DROP COLUMN", re: /\bDROP\s+COLUMN\b/i },
  { label: "DROP SCHEMA", re: /\bDROP\s+SCHEMA\b/i },
  { label: "DROP TYPE", re: /\bDROP\s+TYPE\b/i },
  { label: "TRUNCATE", re: /\bTRUNCATE\b/i },
  // Catches `ALTER TABLE x DROP "col"` where the COLUMN keyword is omitted.
  { label: "ALTER TABLE ... DROP", re: /\bALTER\s+TABLE\b[^;]*?\bDROP\b/i },
];

/** SQL comments must not trigger the scan — our own migrations use `-- DropTable` headers. */
function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n\r]*/g, " ");
}

function migrationsOnDisk() {
  const dir = path.join(process.cwd(), "prisma", "migrations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readMigrationSql(name) {
  const file = path.join(process.cwd(), "prisma", "migrations", name, "migration.sql");
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function scanDestructive(names) {
  const found = [];
  for (const name of names) {
    const sql = stripSqlComments(readMigrationSql(name));
    const statements = DESTRUCTIVE_PATTERNS.filter((p) => p.re.test(sql)).map((p) => p.label);
    if (statements.length > 0) found.push({ name, statements });
  }
  return found;
}

/** Migration names on disk that the database has not recorded as finished. */
async function pendingMigrations(schema) {
  const connectionString = resolveConnectionString();
  if (!connectionString) return { pending: migrationsOnDisk(), known: false };

  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  const client = new Client({
    connectionString: url.toString(),
    ssl: process.env.VERCEL ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const res = await client.query(
      `SELECT migration_name FROM "${schema}"."_prisma_migrations" WHERE finished_at IS NOT NULL`,
    );
    const applied = new Set(res.rows.map((r) => r.migration_name));
    return { pending: migrationsOnDisk().filter((n) => !applied.has(n)), known: true };
  } catch {
    // No migration history yet (fresh schema) — treat everything as pending.
    return { pending: migrationsOnDisk(), known: false };
  } finally {
    await client.end().catch(() => {});
  }
}

function runPrismaMigrateDeploy(schema) {
  const prismaCli = require.resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, PAGAPRO_DATABASE_SCHEMA: schema },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed with exit code ${result.status}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const target = describeDeployTarget();
  console.log(`[pagapro] migrations target: ${formatTarget(target)}${dryRun ? " (dry run)" : ""}`);

  if (!target.hasConnection) {
    throw new Error(
      "No PostgreSQL connection configured (DATABASE_URL or a Vercel Postgres variable).",
    );
  }

  // Guard A is independent of what is pending, so evaluate it before touching the DB.
  const preflight = evaluateSchemaChange();
  if (!preflight.allowed) {
    console.warn(preflight.reason);
    if (preflight.fatal) process.exitCode = 1;
    return;
  }

  const { pending, known } = await pendingMigrations(target.targetSchema);
  if (pending.length === 0 && known) {
    console.log("[pagapro] no pending migrations.");
    return;
  }
  console.log(
    `[pagapro] ${pending.length} pending migration(s): ${pending.join(", ") || "(unknown)"}`,
  );

  const destructive = scanDestructive(pending);
  const verdict = evaluateSchemaChange({ destructiveMigrations: destructive });
  if (!verdict.allowed) {
    console.error(verdict.reason);
    process.exitCode = verdict.fatal ? 1 : 0;
    return;
  }

  if (destructive.length > 0) {
    console.log(
      `[pagapro] ${destructive.length} destructive migration(s) permitted here: ${destructive
        .map((d) => `${d.name} (${d.statements.join(", ")})`)
        .join(", ")}`,
    );
  }

  if (dryRun) {
    console.log("[pagapro] dry run — would apply the migrations listed above.");
    return;
  }

  runPrismaMigrateDeploy(target.targetSchema);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

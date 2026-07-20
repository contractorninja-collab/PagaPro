/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Runs the DOCX template seeders against whichever database and blob store the
 * environment points at.
 *
 * Usage: node scripts/seed-templates.cjs <contracts|leave|termination|all>
 *
 * Replaces three inline `node -e` one-liners that had two defects making remote
 * seeding silently wrong:
 *   - `dotenv.config({ override: true })` let the local .env beat real shell
 *     env vars, so `DATABASE_URL=<prod> npm run termination:seed` seeded the
 *     developer's laptop;
 *   - no `{ schema }` was passed to PrismaPg, so it wrote to `public` even when
 *     PAGAPRO_DATABASE_SCHEMA said otherwise.
 * Both made "re-seed production" look like it worked while changing nothing there.
 */
require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { describeStorage, storageDriver } = require("./seed-storage.cjs");
const { evaluateSchemaChange } = require("./lib/deploy-guard.cjs");

/**
 * `--deploy-guard` is passed by vercel-build. Template seeding writes
 * DocumentTemplateVersion rows and blobs, so it obeys the same invariant as
 * migrations: a non-production deployment must not write to production.
 * Returns a reason to skip, or null to proceed.
 */
function deployGuardSkipReason() {
  if (!process.argv.includes("--deploy-guard")) return null;

  if (process.env.VERCEL && storageDriver === "local") {
    return (
      "storage driver is 'local' inside a serverless build — blobs would be written to an " +
      "ephemeral container disk and lost. Set PAGAPRO_STORAGE_BUCKET to seed into the bucket."
    );
  }

  const verdict = evaluateSchemaChange();
  if (!verdict.allowed) {
    return "this deployment must not write to the production schema (see the migration guard).";
  }
  return null;
}

const SEEDERS = {
  contracts: () => require("./seed-contract-templates.cjs").seedContractTemplates,
  leave: () => require("./seed-leave-templates.cjs").seedLeaveTemplates,
  termination: () => require("./seed-termination-templates.cjs").seedTerminationTemplates,
};

const which = (process.argv[2] || "all").toLowerCase();
const selected = which === "all" ? Object.keys(SEEDERS) : [which];

for (const name of selected) {
  if (!SEEDERS[name]) {
    console.error(`Unknown seeder "${name}". Use one of: contracts, leave, termination, all.`);
    process.exit(1);
  }
}

// Same precedence as prisma.config.ts and prisma/seed.cjs.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

const databaseSchema =
  process.env.PAGAPRO_DATABASE_SCHEMA?.trim() ||
  (process.env.VERCEL ? "pagapro" : "public");

if (!connectionString) {
  console.error(
    "A PostgreSQL connection is required via DATABASE_URL or a Vercel Postgres environment variable.",
  );
  process.exit(1);
}

const seedConnectionString = (() => {
  const url = new URL(connectionString);
  if (process.env.VERCEL) url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
})();

let host = "?";
try {
  host = new URL(connectionString).hostname;
} catch {
  /* placeholder */
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: seedConnectionString }, { schema: databaseSchema }),
});

async function main() {
  // Print both targets before doing anything — seeding the wrong database or
  // the wrong blob store is the failure mode this whole script exists to prevent.
  console.log(`[seed] database : ${host} schema="${databaseSchema}"`);
  console.log(`[seed] storage  : ${describeStorage()}`);

  const skip = deployGuardSkipReason();
  if (skip) {
    console.warn(`[seed] SKIPPED — ${skip}`);
    return;
  }

  console.log(`[seed] running  : ${selected.join(", ")}`);

  let total = 0;
  for (const name of selected) {
    total += (await SEEDERS[name]()(prisma)) || 0;
  }
  console.log(`[seed] done — ${total} template version(s) published.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

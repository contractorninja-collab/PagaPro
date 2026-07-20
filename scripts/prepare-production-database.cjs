/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { evaluateSchemaChange } = require("./lib/deploy-guard.cjs");

const databaseSchema =
  process.env.PAGAPRO_DATABASE_SCHEMA?.trim() ||
  (process.env.VERCEL ? "pagapro" : "public");

if (!/^[a-z_][a-z0-9_]*$/.test(databaseSchema)) {
  throw new Error(`Invalid PostgreSQL schema name: ${databaseSchema}`);
}

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error("Production Postgres connection is missing");
}

const connectionUrl = new URL(connectionString);
connectionUrl.searchParams.delete("sslmode");

const client = new Client({
  connectionString: connectionUrl.toString(),
  ssl: process.env.VERCEL ? { rejectUnauthorized: false } : undefined,
});

function runPrisma(args) {
  const prismaCli = require.resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    env: {
      ...process.env,
      PAGAPRO_DATABASE_SCHEMA: databaseSchema,
    },
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Prisma ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function main() {
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${databaseSchema}"`);

  const history = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`"${databaseSchema}"."_prisma_migrations"`],
  );

  if (history.rows[0]?.exists) {
    console.log(`Prisma migration history already exists in schema ${databaseSchema}.`);
    return;
  }

  // Bootstrapping runs `db push` and `db seed`. If this ever reaches the
  // production schema from a non-production deployment it would rewrite live
  // data, so it is gated by the same invariant as migrations.
  const verdict = evaluateSchemaChange();
  if (!verdict.allowed) {
    console.warn(verdict.reason);
    console.warn("Refusing to bootstrap a schema that already holds production data.");
    process.exitCode = 1;
    return;
  }

  console.log(`Bootstrapping isolated PagaPRO schema ${databaseSchema}.`);
  runPrisma(["db", "push"]);

  const migrationsPath = path.join(process.cwd(), "prisma", "migrations");
  const migrations = fs
    .readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migration of migrations) {
    runPrisma(["migrate", "resolve", "--applied", migration]);
  }

  console.log(
    `Baselined ${migrations.length} migrations in isolated schema ${databaseSchema}.`,
  );
  runPrisma(["db", "seed"]);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());

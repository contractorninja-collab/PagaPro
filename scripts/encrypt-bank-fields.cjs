/**
 * Encrypts plaintext bank account numbers (Employee.bankAccountIban and
 * EmployeeBankAccount.iban) in place.
 *
 * Runs as part of vercel-build, after migrations: Vercel's secrets never leave
 * Vercel (env pull redacts them as [SENSITIVE]), so build time — where the same
 * DATABASE_URL and FIELD_ENCRYPTION_KEY the runtime uses are injected — is the
 * one place a backfill can run against production. Idempotent by design: rows
 * already in `enc1:` form are skipped, so every deploy is also a sweep that
 * catches any plaintext that slipped in while the key was unset.
 *
 * The storage format must stay in lockstep with src/lib/field-crypto.ts.
 *
 * Local:  node -r dotenv/config scripts/encrypt-bank-fields.cjs
 */
const { createCipheriv, randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const PREFIX = "enc1:";

/**
 * Connection + schema must mirror src/lib/prisma.ts exactly. Two details bite
 * on Vercel and both are silent-to-catastrophic if missed:
 *
 * - `uselibpqcompat=true`: without it the pooler's chain is rejected as a
 *   self-signed certificate and nothing connects at all (loud, at least).
 * - schema `pagapro`, not `public`: with the wrong schema the queries would
 *   find zero rows and this script would report "nothing to encrypt" as
 *   success, leaving every real IBAN in plaintext.
 */
function resolveConnectionString() {
  const raw =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    null;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!process.env.VERCEL) return trimmed;
  const url = new URL(trimmed);
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}

function resolveSchema() {
  return (
    process.env.PAGAPRO_DATABASE_SCHEMA?.trim() ||
    (process.env.VERCEL ? "pagapro" : "public")
  );
}

function encryptField(plain, key) {
  if (!plain || plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

async function main() {
  const rawKey = process.env.FIELD_ENCRYPTION_KEY;
  if (!rawKey) {
    // In the build pipeline a missing key must not fail the deploy — the app
    // itself degrades to plaintext writes with a loud log, and the next deploy
    // after the key is set sweeps everything.
    console.warn("[encrypt-bank-fields] FIELD_ENCRYPTION_KEY not set — skipping backfill.");
    return;
  }
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes base64");

  const connectionString = resolveConnectionString();
  if (!connectionString) throw new Error("No database connection string in the environment");

  const schema = resolveSchema();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }, { schema }),
  });

  const employees = await prisma.employee.findMany({
    where: { bankAccountIban: { not: null } },
    select: { id: true, bankAccountIban: true },
  });
  let employeesUpdated = 0;
  for (const e of employees) {
    if (!e.bankAccountIban || e.bankAccountIban.startsWith(PREFIX)) continue;
    await prisma.employee.update({
      where: { id: e.id },
      data: { bankAccountIban: encryptField(e.bankAccountIban, key) },
    });
    employeesUpdated += 1;
  }

  const accounts = await prisma.employeeBankAccount.findMany({
    select: { id: true, iban: true },
  });
  let accountsUpdated = 0;
  for (const a of accounts) {
    if (!a.iban || a.iban.startsWith(PREFIX)) continue;
    await prisma.employeeBankAccount.update({
      where: { id: a.id },
      data: { iban: encryptField(a.iban, key) },
    });
    accountsUpdated += 1;
  }

  // Schema is printed so a "scanned 0" line can be read as either "nothing to
  // do" or "wrong schema" without guessing.
  console.log(
    JSON.stringify({
      schema,
      employeesScanned: employees.length,
      employeesUpdated,
      accountsScanned: accounts.length,
      accountsUpdated,
    }),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

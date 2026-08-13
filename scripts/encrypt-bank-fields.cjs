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

function resolveConnectionString() {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    null
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

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
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

  console.log(
    JSON.stringify({
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

/**
 * One-time backfill: encrypts existing plaintext bank account numbers
 * (Employee.bankAccountIban and EmployeeBankAccount.iban) in place.
 *
 * Idempotent — rows already in `enc1:` form are skipped, so re-running is safe.
 * The storage format must stay in lockstep with src/lib/field-crypto.ts.
 *
 * Usage:  DATABASE_URL=... FIELD_ENCRYPTION_KEY=... node scripts/encrypt-bank-fields.cjs
 */
const { createCipheriv, randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const PREFIX = "enc1:";

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
  if (!rawKey) throw new Error("FIELD_ENCRYPTION_KEY is required");
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes base64");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
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

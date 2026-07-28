/* eslint-disable */
/**
 * Bootstraps a platform-admin login — the account that can reach the admin
 * console. Use this when nobody can get in: the console is the only UI that
 * grants platform admin, so a lost admin locks you out of your own operator
 * surface.
 *
 * The connection string is never read from a committed file. Supply it for the
 * one command:
 *
 *   ADMIN_BOOTSTRAP_DATABASE_URL="postgres://…" node scripts/create-platform-admin.cjs you@example.com
 *
 * Against a local dev database, plain `DATABASE_URL` from .env is used instead.
 *
 * If the email already exists the account is promoted and its password reset;
 * otherwise a new user is created. Either way the password is temporary and
 * must be rotated at first login, and every existing session for that user is
 * destroyed.
 */
require("dotenv").config({ override: true });
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { randomInt } = require("node:crypto");

const BCRYPT_ROUNDS = 12; // matches src/modules/auth/services/password.ts

/** Unambiguous alphabet (no 0/O, 1/l/I) — temp passwords get copied by hand. */
const TEMP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateTempPassword() {
  const block = () =>
    Array.from({ length: 4 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");
  return `${block()}-${block()}-${block()}`;
}

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: node scripts/create-platform-admin.cjs <email>");
    process.exit(1);
  }

  const conn =
    process.env.ADMIN_BOOTSTRAP_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL;

  if (!conn || conn === "[SENSITIVE]") {
    console.error(
      "No usable connection string. Set ADMIN_BOOTSTRAP_DATABASE_URL to the target database.",
    );
    process.exit(1);
  }

  console.log("Target database host:", new URL(conn).hostname);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });
  try {
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isPlatformAdmin: true },
    });

    let action;
    let userId;

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          isPlatformAdmin: true,
          passwordHash,
          mustChangePassword: true,
          status: "ACTIVE",
        },
      });
      userId = existing.id;
      action = existing.isPlatformAdmin ? "password reset" : "promoted to platform admin";
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          passwordHash,
          isPlatformAdmin: true,
          mustChangePassword: true,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      userId = created.id;
      action = "created";
    }

    // A password change must not leave an older session alive.
    await prisma.session.deleteMany({ where: { userId } }).catch(() => {});

    console.log(`\n  ${email} — ${action}`);
    console.log(`  Temporary password: ${tempPassword}`);
    console.log(`\n  Log in, rotate it immediately, then clear this from your terminal.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

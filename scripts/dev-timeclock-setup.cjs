/* eslint-disable */
/**
 * Dev-only: turn the badge time clock on for a company, create a door device,
 * print its pairing code, and stamp badge codes on the first employees.
 *
 * Usage: node scripts/dev-timeclock-setup.cjs
 */
require("dotenv").config({ override: true });
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { randomBytes, randomInt } = require("node:crypto");

function pairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[randomInt(0, alphabet.length)];
    if (i === 3) out += "-";
  }
  return out;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const wantId = process.env.DEV_DEFAULT_COMPANY_ID?.trim();
    const company =
      (wantId &&
        (await prisma.company.findFirst({
          where: { id: wantId, status: "ACTIVE" },
          select: { id: true, legalName: true },
        }))) ||
      (await prisma.company.findFirst({
        where: { status: "ACTIVE" },
        select: { id: true, legalName: true },
      }));
    if (!company) throw new Error("no active company");

    await prisma.company.update({
      where: { id: company.id },
      data: { timeClockEnabled: true },
    });

    const code = pairingCode();
    const device = await prisma.timeClockDevice.create({
      data: {
        companyId: company.id,
        label: "Tablet — hyrja kryesore",
        location: "Recepsion",
        // Never a usable token; replaced with the real hash at pairing.
        tokenHash: `unpaired:${randomBytes(16).toString("hex")}`,
        pairingCode: code,
        pairingCodeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: { id: true, label: true },
    });

    const employees = await prisma.employee.findMany({
      where: { companyId: company.id, status: "ACTIVE", badgeCode: null },
      orderBy: { createdAt: "asc" },
      take: 3,
      select: { id: true, firstName: true, lastName: true },
    });

    const badges = [];
    let next = 1001;
    for (const e of employees) {
      while (
        await prisma.employee.findFirst({
          where: { companyId: company.id, badgeCode: String(next) },
          select: { id: true },
        })
      ) {
        next += 1;
      }
      await prisma.employee.update({ where: { id: e.id }, data: { badgeCode: String(next) } });
      badges.push(`${next} → ${e.firstName} ${e.lastName}`);
      next += 1;
    }

    console.log(JSON.stringify({ company, device, pairingCode: code, badges }, null, 2));
    console.log(`\nPair at: /skano/lidh?kod=${code}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/* Registers bundled DOCX templates for every existing company during production builds. */
/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { seedContractTemplates } = require("./seed-contract-templates.cjs");
const { seedLeaveTemplates } = require("./seed-leave-templates.cjs");
const { seedTerminationTemplates } = require("./seed-termination-templates.cjs");

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;
const databaseSchema =
  process.env.PAGAPRO_DATABASE_SCHEMA?.trim() ||
  (process.env.VERCEL ? "pagapro" : "public");

if (!connectionString) {
  throw new Error(
    "A PostgreSQL connection is required via DATABASE_URL or a Vercel Postgres environment variable.",
  );
}

const seedConnectionString = (() => {
  if (!process.env.VERCEL) return connectionString;
  const url = new URL(connectionString);
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
})();

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: seedConnectionString },
    { schema: databaseSchema },
  ),
});

async function main() {
  const contracts = await seedContractTemplates(prisma);
  const leave = await seedLeaveTemplates(prisma);
  const termination = await seedTerminationTemplates(prisma);
  console.log(
    `[templates:seed] Complete (${contracts} contract, ${leave} leave, ${termination} termination version(s) added).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

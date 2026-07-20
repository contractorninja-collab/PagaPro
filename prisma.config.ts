import { config } from "dotenv";
/** Prefer `.env` over stale/global DATABASE_URL (common mis-parse shows PG user `u`). */
config({ override: true });

import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL must be configured");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.cjs",
  },
  datasource: {
    url: databaseUrl,
  },
});

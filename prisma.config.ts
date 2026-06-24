import { config } from "dotenv";
/** Prefer `.env` over stale/global DATABASE_URL (common mis-parse shows PG user `u`). */
config({ override: true });

import { defineConfig, env } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.cjs",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

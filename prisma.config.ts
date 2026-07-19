import { config } from "dotenv";
config();

import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL;

const databaseSchema =
  process.env.PAGAPRO_DATABASE_SCHEMA?.trim() ||
  (process.env.VERCEL ? "pagapro" : "public");

if (!databaseUrl) {
  throw new Error(
    "A PostgreSQL connection is required via DATABASE_URL or a Vercel Postgres environment variable.",
  );
}

const schemaUrl = new URL(databaseUrl);
schemaUrl.searchParams.set("schema", databaseSchema);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.cjs",
  },
  datasource: {
    url: schemaUrl.toString(),
  },
});

import { config as loadEnv } from "dotenv";

/** Next/global env must not shadow `.env` — avoids bogus PG users (e.g. `u`) from broken URLs. */
loadEnv();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseSchema =
  process.env.PAGAPRO_DATABASE_SCHEMA?.trim() ||
  (process.env.VERCEL ? "pagapro" : "public");

/** Required by Prisma 7+ — uses node `pg` via the official adapter. */
const connectionString =
  (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder"
  ).trim();

const runtimeConnectionString = (() => {
  if (!process.env.VERCEL) return connectionString;
  const url = new URL(connectionString);
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
})();

const adapter = new PrismaPg(
  { connectionString: runtimeConnectionString },
  { schema: databaseSchema },
);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

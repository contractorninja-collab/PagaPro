import { config as loadEnv } from "dotenv";

/** Next/global env must not shadow `.env` — avoids bogus PG users (e.g. `u`) from broken URLs. */
loadEnv({ override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Required by Prisma 7+ — uses node `pg` via the official adapter. */
const connectionString =
  (process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder").trim();
const adapter = new PrismaPg({ connectionString });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

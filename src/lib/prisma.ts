import { PrismaClient } from "@prisma/client";

// Next.js dev-mode hot reload re-evaluates modules; without the global cache
// every reload would open a fresh connection pool until SQLite/Postgres
// refuses new ones.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

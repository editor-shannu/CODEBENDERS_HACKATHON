import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Serverless: each function instance keeps a tiny pool, so many instances can't exhaust Postgres's connection limit. */
function pooledUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "2");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * The raw, UNSCOPED client. Only for code that must work without a signed-in tutor:
 * sign-in itself, the public parent pay link, and the database health check.
 * Everything else uses `db` from ./db, which only ever sees the signed-in tutor's rows.
 */
const url = pooledUrl();
export const rawDb = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

// Reuse one client per instance in every environment (production included), so warm invocations don't open new pools.
globalForPrisma.prisma = rawDb;

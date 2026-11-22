import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The raw, UNSCOPED client. Only for code that must work without a signed-in tutor:
 * sign-in itself, the public parent pay link, and the database health check.
 * Everything else uses `db` from ./db, which only ever sees the signed-in tutor's rows.
 */
export const rawDb = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rawDb;

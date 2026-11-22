import "server-only";
import { rawDb } from "./prisma";

export type DbHealth = { ok: true } | { ok: false; reason: "missing_url" | "no_tables" | "unreachable"; detail?: string };

/**
 * Checks the database before a page renders, so a misconfigured deploy shows a setup screen
 * instead of a 500. It never writes: each tutor starts with an empty ledger of their own.
 */
export async function dbHealth(): Promise<DbHealth> {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "missing_url" };
  try {
    await rawDb.user.count({ take: 1 });
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message = e instanceof Error ? e.message : String(e);
    if (code === "P2021" || /does not exist/i.test(message)) return { ok: false, reason: "no_tables" };
    console.error("[baaki] database check failed:", message);
    return { ok: false, reason: "unreachable", detail: code };
  }
}

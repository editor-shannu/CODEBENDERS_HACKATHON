import "server-only";
import { db } from "./db";
import { seedDemo } from "./seed-data";

export type DbHealth = { ok: true } | { ok: false; reason: "missing_url" | "no_tables" | "unreachable"; detail?: string };

let seeding: Promise<unknown> | null = null;

/**
 * Checks the database before a page renders, so a misconfigured deploy shows a setup screen
 * instead of a 500. On an empty database it seeds the demo centre once, dated from today (IST).
 */
export async function dbHealth(): Promise<DbHealth> {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "missing_url" };
  try {
    const families = await db.family.count();
    if (families === 0) {
      seeding ??= seedDemo(db).finally(() => {
        seeding = null;
      });
      await seeding;
    }
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message = e instanceof Error ? e.message : String(e);
    if (code === "P2021" || /does not exist/i.test(message)) return { ok: false, reason: "no_tables" };
    console.error("[baaki] database check failed:", message);
    return { ok: false, reason: "unreachable", detail: code };
  }
}

import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { rawDb } from "./prisma";

export type JoinKid = { name: string; batch: string };

export const joinSchema = z.object({
  code: z.string().min(6).max(40),
  parentName: z.string().trim().min(2, "Add your name").max(60),
  language: z.enum(["te", "en", "hi"]).default("te"),
  kids: z
    .array(z.object({ name: z.string().trim().min(2, "Add your child's name").max(60), batch: z.string().trim().min(1, "Add the class").max(40) }))
    .min(1, "Add at least one child")
    .max(4),
  note: z.string().trim().max(200).default(""),
});

export const parseKids = (s: string): JoinKid[] => {
  try {
    const j = JSON.parse(s);
    return Array.isArray(j) ? j.filter((k) => k && typeof k.name === "string").map((k) => ({ name: String(k.name), batch: String(k.batch ?? "") })) : [];
  } catch {
    return [];
  }
};

/** The signed-in tutor's join code, created on first use. */
export async function ensureJoinCode(): Promise<string> {
  const s = await db.settings.findFirst({ select: { joinCode: true, userId: true } });
  if (!s) throw new Error("Finish setup first");
  if (s.joinCode) return s.joinCode;
  const code = randomBytes(6).toString("base64url");
  await db.settings.update({ where: { userId: s.userId }, data: { joinCode: code } });
  return code;
}

/** Public: the centre behind a join code (name and city only). */
export async function centreForCode(code: string) {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) return null;
  return rawDb.settings.findFirst({ where: { joinCode: code }, select: { userId: true, centreName: true, tutorName: true, city: true } });
}

/** Most common fee already charged in a batch, used to prefill approval. */
export function suggestedFee(batch: string, students: { batch: string; monthlyFee: number; active: boolean }[]): number {
  const fees = students.filter((s) => s.active && s.batch.toLowerCase() === batch.toLowerCase()).map((s) => s.monthlyFee);
  const pool = fees.length ? fees : students.filter((s) => s.active).map((s) => s.monthlyFee);
  if (!pool.length) return 1500;
  const count = new Map<number, number>();
  for (const f of pool) count.set(f, (count.get(f) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

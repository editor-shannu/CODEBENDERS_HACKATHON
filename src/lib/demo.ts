import "server-only";
import { randomBytes } from "node:crypto";
import { rawDb } from "./prisma";
import { seedDemo } from "./demo-seed";

/** Demo accounts are throwaway users with synthetic data only. They never touch a real tutor's rows. */
export const DEMO_EMAIL_DOMAIN = "demo.baaki.local";
export const isDemoEmail = (email: string | null | undefined) => !!email && email.endsWith(`@${DEMO_EMAIL_DOMAIN}`);

const TENANT_TABLES = [
  "joinRequest", "agentAction", "agentPlan", "paymentClaim", "payment", "invoice", "reminder", "payPromise", "student", "family", "bill", "keyDate", "settings",
] as const;

/** Removes demo accounts older than 12 hours, with every row they own. */
export async function sweepOldDemos() {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const old = await rawDb.user.findMany({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` }, createdAt: { lt: cutoff } }, select: { id: true }, take: 200 });
  if (!old.length) return;
  const ids = old.map((u) => u.id);
  for (const t of TENANT_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (rawDb[t] as any).deleteMany({ where: { userId: { in: ids } } });
  }
  await rawDb.user.deleteMany({ where: { id: { in: ids } } });
}

/** Creates a fresh demo account seeded with the synthetic Lakshmi Teaching Point centre. */
export async function createDemoUser() {
  await sweepOldDemos().catch((e) => console.warn("[baaki] demo sweep failed:", e instanceof Error ? e.message : e));
  const tag = randomBytes(6).toString("hex");
  const user = await rawDb.user.create({
    data: { firebaseUid: `demo_${tag}`, email: `${tag}@${DEMO_EMAIL_DOMAIN}`, name: "Lakshmi Devi (demo)" },
  });
  await seedDemo(user.id);
  return user;
}

import "server-only";
import { db } from "./db";
import { todayIST } from "./dates";
import { balanceOf } from "./invoice-status";

export type HouseStatusValue = "paid" | "promised" | "owed";

/** For the UI branch: a family's window. Lit = paid, half-lit = promised (open promise), dark = owed. Drafts don't count. */
export async function getHouseStatus(familyId: string): Promise<HouseStatusValue> {
  const f = await db.family.findUnique({
    where: { id: familyId },
    select: { invoices: { where: { status: { not: "DRAFT" } }, select: { amount: true, payments: { select: { amount: true } } } }, promises: { where: { kept: null, promisedDate: { gte: todayIST() } }, select: { id: true } } },
  });
  if (!f) return "owed";
  const balance = f.invoices.reduce((s, i) => s + balanceOf(i), 0);
  if (balance <= 0) return "paid";
  return f.promises.length ? "promised" : "owed";
}

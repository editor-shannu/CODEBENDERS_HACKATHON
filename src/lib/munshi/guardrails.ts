import { formatINR } from "../money";

/** Amounts a message to this family may mention: what they owe, each unpaid invoice's balance, their monthly fee, their open promise. */
export function allowedAmounts(f: { stats: { balance: number; monthlyTotal: number; unpaid: { amount: number; payments: { amount: number }[] }[]; openPromise: { amount: number } | null } }): number[] {
  const out = new Set<number>([f.stats.balance, f.stats.monthlyTotal]);
  for (const i of f.stats.unpaid) out.add(i.amount - i.payments.reduce((s, p) => s + p.amount, 0));
  if (f.stats.openPromise) out.add(f.stats.openPromise.amount);
  return [...out].filter((n) => n > 0);
}

const AMOUNT = /(₹|rs\.?\s?|inr\s?)\s*([\d,]+(?:\.\d+)?)/gi;

/** Guardrail: any rupee amount in a drafted message must match a value from the database, else it is dropped. */
export function checkAmounts(text: string, allowed: number[]): string {
  const ok = new Set(allowed.map((n) => Math.round(n)));
  return text
    .replace(AMOUNT, (m, _sym, digits: string) => (ok.has(Math.round(Number(digits.replace(/,/g, "")))) ? m : ""))
    .replace(/[ \t]{2,}/g, " ");
}

export { formatINR };

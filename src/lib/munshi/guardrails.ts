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


/** Every number that appeared in tool results, so an AI answer can only quote amounts it looked up. */
export function numbersIn(results: unknown[]): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number") out.push(v);
    else if (typeof v === "string") for (const m of v.matchAll(/[\d,]{2,}/g)) out.push(Number(m[0].replace(/,/g, "")));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  results.forEach(walk);
  return out.filter((n) => Number.isFinite(n));
}

const THREATS = /\b(police|legal action|court|lawyer|sue|shame|shameful|ashamed|blacklist|expel|kick (him|her|them) out|stop (his|her|their) classes|stop classes|no more classes|warning you|or else|consequences|defaulter|cheat(er|ing)?|liar)\b/i;

/** True when a text threatens or shames a family. Such text is never shown or sent. */
export function isThreatening(text: string): boolean {
  return THREATS.test(text);
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹14,500 · ₹1,25,000 (Indian grouping). */
export function formatINR(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}₹${inr.format(Math.round(Math.abs(amount)))}`;
}

/** Compact for tiles: ₹14.5k, ₹1.2L */
export function formatINRShort(amount: number): string {
  const a = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(a >= 1000000 ? 0 : 1)}L`;
  if (a >= 1000) return `${sign}₹${(a / 1000).toFixed(a >= 10000 ? 1 : 1).replace(/\.0$/, "")}k`;
  return `${sign}₹${a}`;
}

export function parseRupees(input: string): number | null {
  const n = Number(String(input).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Baaki's plans. Prices in rupees; Razorpay takes paise. */
export const PLANS = {
  PRO_MONTH: { plan: "PRO", label: "Baaki Pro · monthly", rupees: 99, days: 30 },
  PRO_YEAR: { plan: "PRO", label: "Baaki Pro · yearly", rupees: 999, days: 365 },
  CENTRE_MONTH: { plan: "CENTRE", label: "Baaki Centre · monthly", rupees: 299, days: 30 },
} as const;
export type PlanKey = keyof typeof PLANS;
export const isPlanKey = (k: unknown): k is PlanKey => typeof k === "string" && k in PLANS;

/** Students the Free plan covers. */
export const FREE_STUDENT_LIMIT = 10;

/** The plan in force today: a paid plan past its end date counts as Free. */
export function effectivePlan(s: { plan?: string | null; planUntil?: Date | null } | null | undefined, now = new Date()): "FREE" | "PRO" | "CENTRE" {
  if (!s?.plan || s.plan === "FREE") return "FREE";
  if (s.planUntil && s.planUntil < now) return "FREE";
  return s.plan === "CENTRE" ? "CENTRE" : "PRO";
}

/** Extends from the later of today or the current end date, so renewing early never loses days. */
export function extendUntil(current: Date | null | undefined, days: number, now = new Date()): Date {
  const base = current && current > now ? current : now;
  return new Date(base.getTime() + days * 86_400_000);
}

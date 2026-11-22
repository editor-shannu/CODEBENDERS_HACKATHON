import "server-only";
import { db } from "../db";

export type PlanStepView = {
  id: string;
  step: number;
  type: string;
  familyId: string | null;
  billId: string | null;
  title: string;
  detail: string;
  reason: string;
  amount: number;
  collected: number;
  status: string;
  payload: Record<string, unknown>;
};

export type ActivePlan = {
  id: string;
  title: string;
  goal: string;
  gap: number;
  rentAmount: number;
  rentDate: string;
  covered: number;
  done: number;
  total: number;
  steps: PlanStepView[];
};

const parse = (s: string): Record<string, unknown> => {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
};

/** The persisted Rent Defense Plan (ACTIVE), with progress: covered vs gap, done vs pending steps. */
export async function loadActivePlan(): Promise<ActivePlan | null> {
  const plan = await db.agentPlan.findFirst({ where: { status: { in: ["ACTIVE", "DONE"] } }, orderBy: { createdAt: "desc" }, include: { actions: { orderBy: { step: "asc" } } } });
  if (!plan) return null;
  const steps: PlanStepView[] = plan.actions.map((a) => {
    const p = parse(a.payload);
    return {
      id: a.id,
      step: a.step ?? 0,
      type: a.type,
      familyId: a.familyId,
      billId: typeof p.billId === "string" ? p.billId : null,
      title: a.title,
      detail: a.detail,
      reason: a.reason,
      amount: Number(p.amount ?? 0),
      collected: Number(p.collected ?? 0),
      status: a.status,
      payload: p,
    };
  });
  const covered = steps.reduce((s, x) => s + (x.status === "DONE" ? Math.max(x.amount, x.collected) : x.collected), 0);
  return {
    id: plan.id,
    title: plan.title,
    goal: plan.goal,
    gap: plan.gap,
    rentAmount: plan.rentAmount,
    rentDate: plan.rentDate,
    covered,
    done: steps.filter((s) => s.status === "DONE").length,
    total: steps.length,
    steps,
  };
}

/** A payment from a family counts toward any open plan step for that family. */
export async function settlePlanForPayment(familyId: string, amount: number) {
  if (amount <= 0) return;
  const steps = await db.agentAction.findMany({
    where: { familyId, planId: { not: null }, status: { not: "DONE" }, type: { in: ["REMIND", "DISCOUNT", "FOLLOW_UP"] }, plan: { status: "ACTIVE" } },
    orderBy: { step: "asc" },
  });
  let left = amount;
  for (const s of steps) {
    if (left <= 0) break;
    const p = parse(s.payload);
    const target = Number(p.amount ?? 0);
    const collected = Number(p.collected ?? 0);
    const add = target > 0 ? Math.min(left, target - collected) : left;
    if (add <= 0) continue;
    left -= add;
    const now = collected + add;
    await db.agentAction.update({ where: { id: s.id }, data: { payload: JSON.stringify({ ...p, collected: now }), status: target > 0 && now >= target ? "DONE" : s.status } });
  }
  await closePlanIfDone();
}

/** Deferring a bill completes the matching DEFER_BILL step. */
export async function settlePlanForBill(billId: string) {
  const steps = await db.agentAction.findMany({ where: { type: "DEFER_BILL", planId: { not: null }, status: { not: "DONE" }, plan: { status: "ACTIVE" } } });
  for (const s of steps) {
    const p = parse(s.payload);
    if (p.billId === billId) await db.agentAction.update({ where: { id: s.id }, data: { status: "DONE", payload: JSON.stringify({ ...p, collected: Number(p.amount ?? 0) }) } });
  }
  await closePlanIfDone();
}

async function closePlanIfDone() {
  const plan = await loadActivePlan();
  if (plan && plan.covered >= plan.gap && plan.gap > 0) await db.agentPlan.update({ where: { id: plan.id }, data: { status: "DONE" } });
}

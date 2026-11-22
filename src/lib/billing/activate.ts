import "server-only";
import { rawDb } from "../prisma";
import { extendUntil, isPlanKey, PLANS } from "./plans";

/** Marks an order paid and extends the tutor's plan. Safe to call twice (checkout handler and webhook). */
export async function activateOrder(orderId: string, paymentId: string): Promise<{ ok: boolean; plan?: string; until?: Date }> {
  const order = await rawDb.billingOrder.findUnique({ where: { orderId } });
  if (!order || !isPlanKey(order.plan)) return { ok: false };
  const settings = await rawDb.settings.findUnique({ where: { userId: order.userId }, select: { planUntil: true, plan: true } });
  if (order.status === "PAID") return { ok: true, plan: settings?.plan, until: settings?.planUntil ?? undefined };
  const p = PLANS[order.plan];
  const until = extendUntil(settings?.plan === p.plan ? settings.planUntil : null, p.days);
  await rawDb.$transaction([
    rawDb.billingOrder.update({ where: { orderId }, data: { status: "PAID", paymentId, paidAt: new Date() } }),
    rawDb.settings.update({ where: { userId: order.userId }, data: { plan: p.plan, planUntil: until } }),
  ]);
  return { ok: true, plan: p.plan, until };
}

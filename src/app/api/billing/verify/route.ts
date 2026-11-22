import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { rawDb } from "@/lib/prisma";
import { verifySignature } from "@/lib/billing/razorpay";
import { activateOrder } from "@/lib/billing/activate";

/** Checkout success: verify Razorpay's signature on the server before switching the plan on. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  const orderId = String(b.razorpay_order_id ?? "");
  const paymentId = String(b.razorpay_payment_id ?? "");
  const order = await rawDb.billingOrder.findUnique({ where: { orderId } });
  if (!order || order.userId !== user.id) return NextResponse.json({ error: "That order isn't yours." }, { status: 404 });
  if (!verifySignature(orderId, paymentId, String(b.razorpay_signature ?? ""))) {
    await rawDb.billingOrder.update({ where: { orderId }, data: { status: order.status === "PAID" ? "PAID" : "FAILED" } });
    return NextResponse.json({ error: "Payment couldn't be verified. If money left your account, Razorpay refunds it automatically." }, { status: 400 });
  }
  const r = await activateOrder(orderId, paymentId);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: r.ok, plan: r.plan, until: r.until });
}

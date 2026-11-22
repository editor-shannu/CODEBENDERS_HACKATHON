import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/billing/razorpay";
import { activateOrder } from "@/lib/billing/activate";

/** Optional Razorpay webhook (payment.captured / order.paid), in case the tab closed before the handler ran. */
export async function POST(req: Request) {
  const body = await req.text();
  if (!verifyWebhook(body, req.headers.get("x-razorpay-signature") ?? "")) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const e = JSON.parse(body) as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
  const pay = e.payload?.payment?.entity;
  if ((e.event === "payment.captured" || e.event === "order.paid") && pay?.order_id && pay.id) await activateOrder(pay.order_id, pay.id);
  return NextResponse.json({ ok: true });
}

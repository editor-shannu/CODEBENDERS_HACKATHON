import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { rawDb } from "@/lib/prisma";
import { isPlanKey, PLANS } from "@/lib/billing/plans";
import { createOrder, razorpayEnabled, razorpayKeyId, razorpayTestMode } from "@/lib/billing/razorpay";

/** Creates a Razorpay order for a plan. The amount always comes from the server's plan table. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!razorpayEnabled()) return NextResponse.json({ error: "Payments aren't switched on yet: the Razorpay keys are missing on the server." }, { status: 503 });
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: unknown };
  if (!isPlanKey(plan)) return NextResponse.json({ error: "Pick a plan." }, { status: 400 });
  const p = PLANS[plan];
  try {
    const orderId = await createOrder(p.rupees * 100, `baaki_${user.id.slice(-8)}_${Date.now()}`, { userId: user.id, plan });
    await rawDb.billingOrder.create({ data: { userId: user.id, plan, amount: p.rupees * 100, orderId } });
    return NextResponse.json({ orderId, amount: p.rupees * 100, currency: "INR", keyId: razorpayKeyId(), label: p.label, test: razorpayTestMode(), name: user.name, email: user.email });
  } catch (e) {
    return NextResponse.json({ error: `Couldn't start the payment: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 502 });
  }
}

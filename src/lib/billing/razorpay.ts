import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Razorpay over plain REST (no SDK). Test keys (rzp_test_…) work without KYC. */
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID?.trim() || "";
const secret = () => process.env.RAZORPAY_KEY_SECRET?.trim() || "";
export const razorpayEnabled = () => !!razorpayKeyId() && !!secret();
export const razorpayTestMode = () => razorpayKeyId().startsWith("rzp_test_");

export async function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${razorpayKeyId()}:${secret()}`).toString("base64")}` },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: receipt.slice(0, 40), notes }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
  if (!res.ok || !data.id) throw new Error(data.error?.description ?? `Razorpay said ${res.status}`);
  return data.id;
}

/** Checkout's handler signature: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function verifySignature(orderId: string, paymentId: string, signature: string, key = secret()): boolean {
  if (!key || !orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", key).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyWebhook(body: string, signature: string): boolean {
  const key = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!key || !signature) return false;
  const expected = createHmac("sha256", key).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

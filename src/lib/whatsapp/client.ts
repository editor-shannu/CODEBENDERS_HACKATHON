import "server-only";
import crypto from "node:crypto";

const GRAPH = "https://graph.facebook.com/v25.0";

export const whatsappEnabled = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** Meta signs every webhook POST with the app secret (X-Hub-Signature-256: sha256=<hex>). */
export function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // local testing only
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

async function send(body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
  });
  if (!res.ok) console.error("[whatsapp] send failed", res.status, (await res.text()).slice(0, 300));
}

export const sendText = (to: string, text: string) => send({ to, type: "text", text: { body: text.slice(0, 4096), preview_url: true } });

/** Up to 3 reply buttons (title max 20 chars, body max 1024). */
export function sendButtons(to: string, text: string, buttons: { id: string; title: string }[]) {
  return send({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: text.slice(0, 1024) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) },
    },
  });
}

export const markRead = (messageId: string) => send({ status: "read", message_id: messageId });

/** WHATSAPP_TUTORS="919876543210=tutor@gmail.com,91...=other@..." links a WhatsApp number to a Baaki account. */
export function tutorEmailFor(waId: string): string | null {
  const digits = waId.replace(/\D/g, "");
  for (const pair of (process.env.WHATSAPP_TUTORS ?? "").split(",")) {
    const [num, email] = pair.split("=").map((x) => x?.trim());
    if (num && email && num.replace(/\D/g, "") === digits) return email.toLowerCase();
  }
  return null;
}

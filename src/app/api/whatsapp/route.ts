import { NextResponse, after } from "next/server";
import { getOrigin } from "@/lib/origin";
import { validSignature, whatsappEnabled } from "@/lib/whatsapp/client";
import { handleIncoming, parseWebhook } from "@/lib/whatsapp/handle";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Meta's one-time webhook check: echo hub.challenge when the verify token matches. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && !!process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new NextResponse(u.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new NextResponse("Forbidden", { status: 403 });
}

/** Incoming tutor messages: acknowledge at once (Meta retries slow webhooks), then let Munshi answer. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("Bad signature", { status: 401 });
  if (!whatsappEnabled()) return NextResponse.json({ ok: true, skipped: "not configured" });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  const messages = parseWebhook(body);
  if (messages.length) {
    const origin = await getOrigin();
    after(async () => {
      for (const m of messages) {
        try {
          await handleIncoming(m, origin);
        } catch (e) {
          console.error("[whatsapp] handle failed", e);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}

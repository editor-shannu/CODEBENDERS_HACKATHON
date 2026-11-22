import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseChat } from "@/lib/whatsapp-import";

export const dynamic = "force-dynamic";

const go = (req: Request, path: string) => NextResponse.redirect(new URL(path, req.url), 303);

/**
 * Web Share Target. With Baaki installed, "Share → Baaki" from WhatsApp, GPay, PhonePe or Messages lands here:
 * a chat export opens the WhatsApp import, a screenshot or an SMS opens payment matching.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return go(req, "/login?next=/home");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return go(req, "/paid");
  }
  const file = form.get("file");
  const text = [form.get("title"), form.get("text"), form.get("url")].filter((x) => typeof x === "string" && x).join("\n").slice(0, 2000);

  if (file instanceof File && file.size > 0) {
    if (file.type.startsWith("image/")) {
      if (file.size > 4_000_000) return go(req, "/paid?error=too-big");
      const buf = Buffer.from(await file.arrayBuffer());
      const item = await db.inboxItem.create({ data: { kind: "PAYMENT_IMAGE", image: `data:${file.type};base64,${buf.toString("base64")}` } });
      return go(req, `/paid?inbox=${item.id}`);
    }
    if (file.size > 3_000_000) return go(req, "/import?error=too-big");
    const body = await file.text();
    if (parseChat(body).length >= 2) {
      const item = await db.inboxItem.create({ data: { kind: "CHAT", text: body } });
      return go(req, `/import?inbox=${item.id}`);
    }
    const item = await db.inboxItem.create({ data: { kind: "PAYMENT_TEXT", text: body.slice(0, 2000) } });
    return go(req, `/paid?inbox=${item.id}`);
  }
  if (text) {
    const item = await db.inboxItem.create({ data: { kind: "PAYMENT_TEXT", text } });
    return go(req, `/paid?inbox=${item.id}`);
  }
  return go(req, "/paid");
}

export function GET(req: Request) {
  return go(req, "/paid");
}

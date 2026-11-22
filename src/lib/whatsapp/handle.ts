import "server-only";
import { rawDb } from "@/lib/prisma";
import { runAsUser } from "@/lib/auth/session";
import { sendButtons, sendText, tutorEmailFor, markRead } from "./client";

export type Incoming = { from: string; id: string; text?: string; buttonId?: string };

/** Pulls the tutor's messages out of a Cloud API webhook payload (ignores status updates). */
export function parseWebhook(body: unknown): Incoming[] {
  const out: Incoming[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = body as any;
  for (const entry of b?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const m of change?.value?.messages ?? []) {
        if (m.type === "text") out.push({ from: m.from, id: m.id, text: String(m.text?.body ?? "") });
        else if (m.type === "interactive" && m.interactive?.button_reply) out.push({ from: m.from, id: m.id, buttonId: String(m.interactive.button_reply.id) });
        else if (m.type === "button") out.push({ from: m.from, id: m.id, text: String(m.button?.text ?? "") });
        else out.push({ from: m.from, id: m.id });
      }
    }
  }
  return out;
}

const HELP =
  "Namaste! I'm Munshi, your Baaki clerk on WhatsApp.\n\nTry:\n• Ravi paid 1500 cash\n• Who owes me the most?\n• Remind everyone who's late\n• What if Venkatesh pays 15 days late?\n\nI'll ask before any money moves.";

// Short per-number memory so "and him?" works between messages (best effort; resets on cold start).
const memory = new Map<string, { who: "you" | "munshi"; text: string }[]>();

export async function handleIncoming(msg: Incoming, origin: string) {
  await markRead(msg.id).catch(() => {});
  const email = tutorEmailFor(msg.from);
  if (!email) {
    await sendText(msg.from, "This number isn't linked to a Baaki account yet. Ask the tutor to add it in WHATSAPP_TUTORS.");
    return;
  }
  const user = await rawDb.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    await sendText(msg.from, `No Baaki account found for ${email}. Sign in once at ${origin} first.`);
    return;
  }

  await runAsUser(user.id, async () => {
    if (msg.buttonId) {
      const [kind, id] = msg.buttonId.split(":");
      const { db } = await import("@/lib/db");
      if (kind === "approve" && id) {
        const { approveAction } = await import("@/lib/munshi/execute");
        const line = await approveAction(id);
        await sendText(msg.from, line ? `Done ✅ ${line}` : "That one was already handled.");
      } else if (kind === "skip" && id) {
        await db.agentAction.updateMany({ where: { id, status: "PENDING" }, data: { status: "SKIPPED" } });
        await sendText(msg.from, "Okay, skipped. Nothing was changed.");
      }
      return;
    }

    const text = msg.text?.trim();
    if (!text) {
      await sendText(msg.from, "I can read text messages for now. Type what happened, like \"Ravi paid 1500 cash\".");
      return;
    }
    if (/^(help|menu|start|hi|hello|namaste)\b/i.test(text)) {
      await sendText(msg.from, HELP);
      return;
    }

    const { askMunshi } = await import("@/lib/munshi/agent");
    const { loadDashboard } = await import("@/lib/board-view");
    const { board, forecast, input } = await loadDashboard();
    const history = memory.get(msg.from) ?? [];
    const r = await askMunshi(text.slice(0, 500), {
      families: board.families,
      forecast,
      input,
      totalPending: board.totalPending,
      today: board.today,
      autonomy: board.settings.autonomy,
      centreName: board.settings.centreName,
      tutorName: board.settings.tutorName,
      origin,
      direct: true,
      question: text.slice(0, 500),
      history: history.slice(-8),
    });
    memory.set(msg.from, [...history, { who: "you" as const, text }, { who: "munshi" as const, text: r.answer.slice(0, 400) }].slice(-8));

    const links = (r.links ?? []).slice(0, 6).map((l) => `• ${l.label}: ${l.url}`).join("\n");
    const body = links ? `${r.answer}\n\n${links}` : r.answer;
    const pending = (r.actions ?? []).find((a) => a.id && a.status === "PENDING");
    if (pending?.id && body.length <= 1024) {
      await sendButtons(msg.from, body, [
        { id: `approve:${pending.id}`, title: "Approve" },
        { id: `skip:${pending.id}`, title: "Skip" },
      ]);
    } else {
      await sendText(msg.from, body);
      if (pending?.id) await sendButtons(msg.from, pending.title, [{ id: `approve:${pending.id}`, title: "Approve" }, { id: `skip:${pending.id}`, title: "Skip" }]);
    }
  });
}

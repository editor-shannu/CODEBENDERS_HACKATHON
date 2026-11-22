"use client";

import { useTransition } from "react";
import { RemindButton } from "@/components/actions/RemindButton";
import { Button, LinkButton } from "@/components/ui/Button";
import type { BriefItem } from "@/lib/munshi/rules";
import type { ReminderPayload } from "@/lib/data";
import { applyDueDate } from "@/app/actions";

export function BriefActions({ item, payload }: { item: BriefItem; payload?: ReminderPayload }) {
  const [pending, start] = useTransition();
  if ((item.type === "REMIND" || item.type === "FOLLOW_UP") && payload) {
    const tone = (item.payload?.tone as ReminderPayload["suggestedTone"]) ?? payload.suggestedTone;
    return <RemindButton p={{ ...payload, suggestedTone: tone }} label="Approve & send" variant="plaster" className="min-h-9 px-3" />;
  }
  if (item.type === "PLAN") return <LinkButton href="/munshi#plan" variant="primary" className="min-h-9 px-3">See plan</LinkButton>;
  if (item.type === "CONFIRM") return <LinkButton href="/invoices?filter=claims" variant="plaster" className="min-h-9 px-3">Review</LinkButton>;
  if (item.type === "DUE_DATE" && item.familyId)
    return (
      <Button variant="plaster" className="min-h-9 px-3" disabled={pending} onClick={() => start(async () => void (await applyDueDate(item.familyId!, Number(item.payload?.dueDay), item.reason)))}>
        {pending ? "Applying…" : "Approve"}
      </Button>
    );
  return null;
}

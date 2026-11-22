"use server";

import { revalidatePath } from "next/cache";
import { seatError } from "@/lib/billing/seats";
import { db } from "@/lib/db";
import { rawDb } from "@/lib/prisma";
import { centreForCode, joinSchema, parseKids } from "@/lib/join";
import type { ActionResult } from "./actions";

/** Public: a parent adds their family through the tutor's link. Waits for the tutor's approval. */
export async function submitJoinRequest(input: unknown): Promise<ActionResult> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  const d = parsed.data;
  const centre = await centreForCode(d.code);
  if (!centre) return { ok: false, error: "This join link is not valid any more. Ask your tutor for a new one." };
  const pending = await rawDb.joinRequest.count({ where: { userId: centre.userId, status: "PENDING" } });
  if (pending >= 60) return { ok: false, error: "Too many requests are waiting. Please message your tutor." };
  const dup = await rawDb.joinRequest.findFirst({ where: { userId: centre.userId, status: "PENDING", parentName: { equals: d.parentName, mode: "insensitive" } } });
  if (dup) return { ok: true, message: "Already sent. Your tutor will confirm soon." };
  await rawDb.joinRequest.create({ data: { userId: centre.userId, parentName: d.parentName, language: d.language, kids: JSON.stringify(d.kids), note: d.note } });
  return { ok: true, message: `Sent to ${centre.tutorName || centre.centreName}. You'll get your fee details on WhatsApp.` };
}

/** Tutor: approve a join request with the fee and due day for each child. Creates the family and students. */
export async function approveJoinRequest(input: { id: string; fees: number[]; dueDay: number; batches?: string[] }): Promise<ActionResult> {
  const req = await db.joinRequest.findUnique({ where: { id: input.id } });
  if (!req || req.status !== "PENDING") return { ok: false, error: "This request was already handled" };
  const kids = parseKids(req.kids);
  const dueDay = Math.round(Number(input.dueDay));
  if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 28) return { ok: false, error: "Due day must be 1 to 28" };
  const fees = kids.map((_, i) => Math.round(Number(input.fees[i])));
  if (fees.some((f) => !Number.isFinite(f) || f < 100 || f > 50000)) return { ok: false, error: "Enter a fee of ₹100 or more for each child" };
  const seat = await seatError(req.userId, kids.length);
  if (seat) return { ok: false, error: seat };
  const fam = await db.family.create({ data: { parentName: req.parentName, language: req.language, notes: req.note ? `Joined by link: ${req.note}` : "Joined by link" } });
  for (let i = 0; i < kids.length; i++) {
    const batch = (input.batches?.[i] || kids[i].batch).slice(0, 40);
    await db.student.create({ data: { familyId: fam.id, name: kids[i].name, batch, monthlyFee: fees[i], dueDay } });
  }
  await db.joinRequest.update({ where: { id: req.id }, data: { status: "APPROVED" } });
  revalidatePath("/", "layout");
  return { ok: true, message: `${req.parentName} added` };
}

export async function rejectJoinRequest(id: string): Promise<ActionResult> {
  await db.joinRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED" } });
  revalidatePath("/", "layout");
  return { ok: true };
}

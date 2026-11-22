import "server-only";
import { rawDb } from "../prisma";
import { isDemoEmail } from "../demo";
import { effectivePlan, FREE_STUDENT_LIMIT } from "./plans";

/** Returns an error line when adding `adding` students would pass the Free plan's limit, else null. */
export async function seatError(userId: string, adding = 1): Promise<string | null> {
  const [settings, user, active] = await Promise.all([
    rawDb.settings.findUnique({ where: { userId }, select: { plan: true, planUntil: true } }),
    rawDb.user.findUnique({ where: { id: userId }, select: { email: true } }),
    rawDb.student.count({ where: { userId, active: true } }),
  ]);
  if (isDemoEmail(user?.email)) return null;
  if (effectivePlan(settings) !== "FREE") return null;
  if (active + adding <= FREE_STUDENT_LIMIT) return null;
  const left = Math.max(0, FREE_STUDENT_LIMIT - active);
  return `The Free plan covers ${FREE_STUDENT_LIMIT} students and you have ${active}${left ? `, so ${left} more fit` : ""}. Upgrade to Pro (₹99 a month) in Settings → Plan for unlimited students.`;
}

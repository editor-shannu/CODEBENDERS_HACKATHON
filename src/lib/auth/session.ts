import "server-only";
import { cache } from "react";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { rawDb } from "../prisma";
import { SESSION_COOKIE } from "./config";
import { verifySession } from "./token";

export type SessionUser = { id: string; email: string; name: string; photoUrl: string };

/** The signed-in tutor for this request (cookie verified, user still exists), or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    return null; // outside a request (scripts, tests)
  }
  const id = await verifySession(token);
  if (!id) return null;
  const user = await rawDb.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, photoUrl: true } }).catch(() => null);
  return user;
});

/**
 * Server-to-server callers with no cookie (the WhatsApp webhook) run as a known tutor after their own
 * check (signed webhook + allow-listed phone number). Never call this from a user-facing request.
 */
const actingUser = new AsyncLocalStorage<string>();
export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return actingUser.run(userId, fn);
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Please sign in");
    this.name = "UnauthenticatedError";
  }
}

/** The signed-in user's id; throws when nobody is signed in. Used by the tenant-scoped db client. */
export async function currentUserId(): Promise<string> {
  const asUser = actingUser.getStore();
  if (asUser) return asUser;
  const u = await getSessionUser();
  if (!u) throw new UnauthenticatedError();
  return u.id;
}

/** For pages: the signed-in user, or a redirect to sign-in. */
export async function requireUser(next = "/home"): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/** For tutor pages: signed in AND set up (centre settings saved), else sign-in or onboarding. */
export const requireTutor = cache(async () => {
  const user = await requireUser();
  const settings = await rawDb.settings.findUnique({ where: { userId: user.id } });
  if (!settings) redirect("/onboarding");
  return { user, settings };
});

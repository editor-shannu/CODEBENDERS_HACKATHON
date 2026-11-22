import { NextResponse } from "next/server";
import { z } from "zod";
import { rawDb } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_DAYS, safeNext } from "@/lib/auth/config";
import { verifyFirebaseIdToken } from "@/lib/auth/firebase-verify";
import { isSameOrigin } from "@/lib/auth/same-origin";
import { signSession } from "@/lib/auth/token";

export const dynamic = "force-dynamic";

const body = z.object({ idToken: z.string().min(100).max(4096), next: z.string().max(300).optional() });

/**
 * Exchanges a fresh Firebase Google ID token for Baaki's own httpOnly session cookie.
 * New Google accounts get a user row (sign-up) and go to onboarding; returning ones go to the dashboard.
 */
export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[baaki] sign-in failed:", msg);
    const hint = /AUTH_SECRET/.test(msg)
      ? "Server setup: AUTH_SECRET is missing on this deploy."
      : /P1001|P2021|connect|DATABASE_URL|does not exist/.test(msg)
        ? "Server setup: the database is unreachable or its tables are missing."
        : "Server error while signing in.";
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}

async function handle(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  let identity;
  try {
    identity = await verifyFirebaseIdToken(parsed.data.idToken);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    console.warn("[baaki] sign-in rejected:", why);
    return NextResponse.json({ error: `Google sign-in could not be verified (${why.slice(0, 120)}).` }, { status: 401 });
  }

  const existing = await rawDb.user.findUnique({ where: { firebaseUid: identity.uid } });
  if (!existing) {
    const sameEmail = await rawDb.user.findUnique({ where: { email: identity.email } });
    if (sameEmail) return NextResponse.json({ error: "This email is linked to another sign-in." }, { status: 409 });
  }
  const user = await rawDb.user.upsert({
    where: { firebaseUid: identity.uid },
    update: { email: identity.email, name: identity.name, photoUrl: identity.photoUrl, lastLoginAt: new Date() },
    create: { firebaseUid: identity.uid, email: identity.email, name: identity.name, photoUrl: identity.photoUrl },
  });
  const settings = await rawDb.settings.findUnique({ where: { userId: user.id }, select: { userId: true } });

  const res = NextResponse.json({ next: settings ? safeNext(parsed.data.next) : "/onboarding", isNew: !existing });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

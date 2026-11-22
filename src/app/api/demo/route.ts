import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { signSession } from "@/lib/auth/token";
import { createDemoUser } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One tap, no sign-in: makes a throwaway demo account filled with synthetic data and opens the dashboard.
 * GET so it works as a plain link from the landing page and from a judge's bookmark.
 */
export async function GET(req: Request) {
  try {
    const user = await createDemoUser();
    const res = NextResponse.redirect(new URL("/home", req.url), 303);
    res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // No maxAge: a browser-session cookie, so closing the browser ends the demo. The data is swept later.
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[baaki] demo failed:", msg);
    const hint = /AUTH_SECRET/.test(msg) ? "AUTH_SECRET is not set on this deploy." : /DATABASE_URL|connect|P1001|P2021/.test(msg) ? "The database is not reachable or its tables are missing." : "Something went wrong.";
    const code = (e as { code?: string }).code ?? "";
    const detail = msg.replace(/postgres(ql)?:\/\/\S+/gi, "[db]").replace(/[\w.-]+\.neon\.tech\S*/gi, "[host]").split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 220);
    return new NextResponse(`Demo could not start. ${hint}${code ? ` (${code})` : ""}\n${detail}`, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

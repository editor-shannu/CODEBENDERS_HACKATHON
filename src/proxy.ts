import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { verifySession } from "@/lib/auth/token";

/**
 * Optimistic gate: tutor pages need a valid session cookie, else they bounce to /login.
 * The real check is server-side too (requireTutor in the app layout, and the tenant-scoped db).
 * Public: the landing, /login, the parent pages, pay links, auth API and static files.
 */
export async function proxy(req: NextRequest) {
  const uid = await verifySession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (uid) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/home/:path*", "/families/:path*", "/forecast/:path*", "/invoices/:path*", "/munshi/:path*", "/owes/:path*", "/report/:path*", "/settings/:path*", "/students/:path*", "/onboarding/:path*", "/import/:path*", "/paid/:path*"],
};

/** Shared auth constants, safe to import from the proxy, route handlers and server code. */
export const SESSION_COOKIE = "baaki_session";
export const SESSION_DAYS = 7;
const ISSUER = "baaki";

export function sessionSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET ?? "";
  if (s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 random characters");
  return new TextEncoder().encode(s);
}

export const SESSION_ISSUER = ISSUER;

/** Only same-site relative paths survive as a post-login destination (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.startsWith("/login") || next.startsWith("/api/")) return fallback;
  return next;
}

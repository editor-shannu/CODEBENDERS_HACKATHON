import { jwtVerify, SignJWT } from "jose";
import { SESSION_DAYS, SESSION_ISSUER, sessionSecret } from "./config";

/** Signs Baaki's own session cookie (HS256). It carries only the user id, never Firebase tokens. */
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionSecret());
}

/** Returns the user id in a valid session cookie, or null. Works in the proxy and on the server. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { issuer: SESSION_ISSUER, audience: SESSION_ISSUER, algorithms: ["HS256"] });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

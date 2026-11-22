import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Google's public keys for Firebase ID tokens. Verifying against them needs no service account.
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

export type FirebaseIdentity = { uid: string; email: string; name: string; photoUrl: string };

/**
 * Verifies a Firebase ID token from Google sign-in: signature, issuer, audience (our project),
 * expiry, a recent sign-in (5 minutes, so an old leaked token can't open a session), the Google
 * provider and a verified email.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set");
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ["RS256"],
  });
  const now = Math.floor(Date.now() / 1000);
  const authTime = Number(payload.auth_time ?? 0);
  if (!payload.sub || typeof payload.sub !== "string") throw new Error("token has no subject");
  if (!authTime || authTime > now + 60 || now - authTime > 300) throw new Error("sign-in is not recent");
  const fb = payload.firebase as { sign_in_provider?: string } | undefined;
  if (fb?.sign_in_provider !== "google.com") throw new Error("only Google sign-in is allowed");
  if (payload.email_verified !== true || typeof payload.email !== "string") throw new Error("email is not verified");
  return {
    uid: payload.sub,
    email: payload.email.toLowerCase(),
    name: typeof payload.name === "string" ? payload.name.slice(0, 80) : "",
    photoUrl: typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture.slice(0, 500) : "",
  };
}

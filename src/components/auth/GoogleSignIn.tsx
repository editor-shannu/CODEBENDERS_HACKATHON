"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { firebaseApp, firebaseConfigured } from "@/lib/firebase-client";

/**
 * Google sign-in through Firebase. The Firebase session lives in memory only: we trade the fresh
 * ID token for Baaki's own httpOnly cookie and sign out of Firebase straight away, so no token is
 * ever left in localStorage.
 */
export function GoogleSignIn({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const { getAuth, GoogleAuthProvider, inMemoryPersistence, setPersistence, signInWithPopup, signOut } = await import("firebase/auth");
      const auth = getAuth(firebaseApp());
      await setPersistence(auth, inMemoryPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken(true);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken, next }),
        credentials: "same-origin",
      });
      await signOut(auth).catch(() => {});
      const out = (await res.json().catch(() => ({}))) as { next?: string; error?: string };
      if (!res.ok || !out.next) throw new Error(out.error ?? "Sign-in failed. Please try again.");
      window.location.assign(out.next);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setError(
        code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
          ? "Sign-in was closed before it finished."
          : code === "auth/popup-blocked"
            ? "Your browser blocked the Google window. Allow pop-ups for this site and try again."
            : code === "auth/unauthorized-domain"
              ? "This website isn't on the Firebase authorized domains list yet."
              : e instanceof Error && !code
                ? e.message
                : "Sign-in failed. Please try again.",
      );
      setBusy(false);
    }
  }

  if (!firebaseConfigured) return <p className="font-mono text-xs text-brick">Google sign-in isn&apos;t configured on this deploy (Firebase env vars missing).</p>;

  return (
    <div className="space-y-3">
      <Button onClick={signIn} disabled={busy} className="w-full">
        {busy ? "Signing in…" : "Continue with Google"}
      </Button>
      {error && <p role="alert" className="font-mono text-xs text-brick">{error}</p>}
    </div>
  );
}

/** Clears the session cookie and returns to the landing. */
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
        router.replace("/");
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** Loads Firebase Analytics once in the browser (no-op without a measurement id). */
export function FirebaseAnalytics() {
  useEffect(() => {
    void import("@/lib/firebase-client").then((m) => m.startAnalytics()).catch(() => {});
  }, []);
  return null;
}

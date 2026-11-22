import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Eyebrow } from "@/components/ui/Card";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
import { safeNext } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoEmail } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · Baaki", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const current = await getSessionUser();
  if (current && !isDemoEmail(current.email)) redirect(dest);
  return (
    <div className="mx-auto max-w-md py-10">
      <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/70 hover:text-lamp">← Back</Link>
      <h1 className="mt-4 font-display text-5xl leading-none text-lamp">Baaki</h1>
      <p className="mt-2 text-sm text-plaster/70">The back office for home tutors. Sign in to open your own ledger.</p>
      <Card className="mt-6">
        <Eyebrow className="mb-3">Tutor sign-in</Eyebrow>
        <GoogleSignIn next={dest} />
        <p className="mt-4 text-xs text-dusk-deep/60">New here? Signing in with Google creates your account. Your families and fees are private to you.</p>
      </Card>
      <a href="/api/demo" className="mt-4 flex min-h-12 items-center justify-center border border-lamp font-mono text-xs font-semibold uppercase tracking-[0.14em] text-lamp hover:bg-lamp hover:text-dusk-deep">
        Just looking? Try the demo, no sign-in
      </a>
      <p className="mt-6 text-center text-sm text-plaster/70">
        A parent? <Link href="/parent" className="underline hover:text-lamp">Open your pay link</Link>
      </p>
    </div>
  );
}

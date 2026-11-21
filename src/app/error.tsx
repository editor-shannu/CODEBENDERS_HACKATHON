"use client";

import { Card, Eyebrow } from "@/components/ui/Card";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto max-w-xl">
      <Eyebrow className="text-khata opacity-100">Something went wrong</Eyebrow>
      <h1 className="mt-1 font-display text-3xl leading-tight">This page didn&apos;t load</h1>
      <p className="mt-2 text-sm">Try again. If it keeps happening, check the server logs.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-ink/60">Ref: {error.digest}</p>}
      <button onClick={reset} className="mt-4 border border-ink px-4 py-2 font-mono text-xs uppercase tracking-[0.14em]">
        Try again
      </button>
    </Card>
  );
}

import { Card, Eyebrow } from "@/components/ui/Card";
import type { DbHealth } from "@/lib/db-health";

const COPY: Record<Exclude<DbHealth, { ok: true }>["reason"], { title: string; steps: string[] }> = {
  missing_url: {
    title: "Baaki needs a database",
    steps: [
      "Create a free Postgres database (Neon or Supabase, or Vercel → Storage → Neon).",
      "Add its connection string as DATABASE_URL in Vercel → Project → Settings → Environment Variables.",
      "Redeploy. Tables are created during the build and demo data seeds itself on the first visit.",
    ],
  },
  no_tables: {
    title: "The database has no tables yet",
    steps: ["Redeploy on Vercel (the build runs prisma db push), or run npm run db:push locally against the same DATABASE_URL."],
  },
  unreachable: {
    title: "Can't reach the database",
    steps: [
      "Check that DATABASE_URL in Vercel is correct and the database is running.",
      "For Neon or Supabase, use the pooled connection string and keep ?sslmode=require on the end.",
    ],
  },
};

export function SetupNotice({ health }: { health: Exclude<DbHealth, { ok: true }> }) {
  const c = COPY[health.reason];
  return (
    <Card className="mx-auto max-w-xl">
      <Eyebrow className="text-brick opacity-100">Setup needed</Eyebrow>
      <h1 className="mt-1 font-display text-3xl leading-tight">{c.title}</h1>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
        {c.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {health.detail && <p className="mt-4 font-mono text-xs text-dusk-deep/60">Error code: {health.detail}</p>}
    </Card>
  );
}

import Link from "next/link";

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { h: string; p: string[] }[] }) {
  return (
    <div className="mx-auto max-w-3xl py-10 text-plaster">
      <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-plaster/70 hover:text-lamp">← Baaki</Link>
      <h1 className="mt-4 font-display text-5xl leading-none text-lamp">{title}</h1>
      <p className="mt-2 font-mono text-xs text-plaster/60">Last updated {updated}</p>
      {sections.map((s) => (
        <section key={s.h} className="mt-8">
          <h2 className="font-display text-2xl text-lamp">{s.h}</h2>
          {s.p.map((t, i) => (
            <p key={i} className="mt-2 text-plaster/80">{t}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

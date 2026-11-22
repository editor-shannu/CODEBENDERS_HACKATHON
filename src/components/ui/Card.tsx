import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "ledger" | "ink" | "khata" | "turmeric";
  ruled?: boolean;
  as?: "div" | "section" | "article" | "li";
};

/** Baaki card: flat plaster paper, or dusk-deep with a hairline. */
export function Card({ children, className = "", variant = "ledger", ruled = true, as: Tag = "div" }: Props) {
  const base =
    variant === "ledger"
      ? `${ruled ? "ruled-paper" : "bg-plaster pl-5"} text-dusk-deep border border-dusk-deep/15`
      : variant === "khata"
        ? "bg-brick text-plaster border border-brick"
        : variant === "turmeric"
          ? "bg-lamp text-dusk-deep border border-lamp"
          : "bg-dusk-deep text-plaster border border-plaster/20";
  return <Tag className={`relative ${base} p-4 pr-4 ${className}`}>{children}</Tag>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[11px] uppercase tracking-[0.14em] opacity-70 ${className}`}>{children}</p>;
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-plaster/15 pb-4">
      <div>
        {kicker && <Eyebrow className="text-lamp opacity-100">{kicker}</Eyebrow>}
        <h1 className="font-display text-4xl leading-none tracking-tight md:text-5xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <Card className="py-8 text-center" ruled>
      <p className="font-display text-2xl">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-sm opacity-70">{body}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </Card>
  );
}

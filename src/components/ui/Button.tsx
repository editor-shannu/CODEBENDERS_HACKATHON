import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "mint" | "ink";
const styles: Record<Variant, string> = {
  primary: "bg-lamp text-dusk-deep border-lamp hover:opacity-90",
  ghost: "bg-transparent border-current hover:bg-current/5",
  danger: "bg-transparent text-brick border-brick hover:bg-brick hover:text-plaster",
  mint: "bg-lamp text-dusk-deep border-lamp hover:opacity-90",
  ink: "bg-plaster text-dusk-deep border-plaster hover:opacity-90",
};
const base =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border px-4 font-mono text-xs font-semibold uppercase tracking-[0.12em] transition disabled:opacity-50";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function LinkButton({ href, variant = "primary", className = "", children, external }: { href: string; variant?: Variant; className?: string; children: ReactNode; external?: boolean }) {
  if (external)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={`${base} ${styles[variant]} ${className}`}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export const inputClass =
  "min-h-11 w-full border border-dusk-deep/25 bg-plaster px-3 font-mono text-sm text-dusk-deep outline-none focus:border-slate-mute focus:ring-1 focus:ring-slate-mute";
export const labelClass = "mb-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-dusk-deep/70";

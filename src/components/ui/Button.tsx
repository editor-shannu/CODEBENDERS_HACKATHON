import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "mint" | "ink";
const styles: Record<Variant, string> = {
  primary: "bg-khata text-ledger border-khata hover:bg-[#9a1f26]",
  ghost: "bg-transparent border-current hover:bg-current/5",
  danger: "bg-transparent text-khata border-khata hover:bg-khata hover:text-ledger",
  mint: "bg-mint text-ink border-mint hover:brightness-95",
  ink: "bg-ink text-ledger border-ink hover:bg-black",
};
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 border px-4 font-mono text-xs font-semibold uppercase tracking-[0.12em] transition disabled:opacity-50";

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
  "min-h-11 w-full border border-ink/25 bg-ledger px-3 font-mono text-sm text-ink outline-none focus:border-khata focus:ring-1 focus:ring-khata";
export const labelClass = "mb-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink/70";

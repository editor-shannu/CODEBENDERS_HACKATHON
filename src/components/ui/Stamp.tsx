export function Stamp({ kind, animate = false, className = "" }: { kind: "PAID" | "PARTIAL" | "OVERDUE" | "PROMISED"; animate?: boolean; className?: string }) {
  const color =
    kind === "PAID" ? "border-mint text-mint" : kind === "PARTIAL" ? "border-turmeric text-turmeric" : kind === "PROMISED" ? "border-ink/60 text-ink/70" : "border-khata text-khata";
  return (
    <span
      className={`stamp inline-block select-none border-[3px] px-2 py-0.5 font-mono text-sm font-semibold tracking-[0.2em] ${color} ${animate ? "stamp-slam" : "-rotate-[8deg]"} ${className}`}
      aria-label={kind}
    >
      {kind}
    </span>
  );
}

export function Stamp({ kind, animate = false, className = "" }: { kind: "PAID" | "PARTIAL" | "OVERDUE" | "PROMISED"; animate?: boolean; className?: string }) {
  const color =
    kind === "PAID" ? "border-brick text-brick" : kind === "PARTIAL" ? "border-lamp/70 text-lamp" : kind === "PROMISED" ? "border-slate-mute text-slate-mute" : "border-brick text-brick";
  return (
    <span
      className={`stamp inline-block select-none border-[3px] px-2 py-0.5 font-mono text-sm font-semibold tracking-[0.2em] ${color} ${animate ? "stamp-slam" : "-rotate-[8deg]"} ${className}`}
      aria-label={kind}
    >
      {kind}
    </span>
  );
}

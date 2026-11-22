import { formatINR } from "@/lib/money";

export function MoneyText({ amount, className = "", tone }: { amount: number; className?: string; tone?: "red" | "lamp" | "lamp-dim" }) {
  const color = tone === "red" ? "text-brick" : tone === "lamp" ? "text-lamp" : tone === "lamp-dim" ? "text-lamp/80" : "";
  return <span className={`font-mono tabular-nums ${color} ${className}`}>{formatINR(amount)}</span>;
}

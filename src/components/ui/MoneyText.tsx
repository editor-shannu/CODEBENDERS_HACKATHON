import { formatINR } from "@/lib/money";

export function MoneyText({ amount, className = "", tone }: { amount: number; className?: string; tone?: "red" | "mint" | "turmeric" }) {
  const color = tone === "red" ? "text-brick" : tone === "mint" ? "text-lamp" : tone === "turmeric" ? "text-lamp/80" : "";
  return <span className={`font-mono tabular-nums ${color} ${className}`}>{formatINR(amount)}</span>;
}

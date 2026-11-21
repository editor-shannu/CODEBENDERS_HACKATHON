import { formatINR } from "@/lib/money";

export function MoneyText({ amount, className = "", tone }: { amount: number; className?: string; tone?: "red" | "mint" | "turmeric" }) {
  const color = tone === "red" ? "text-khata" : tone === "mint" ? "text-mint" : tone === "turmeric" ? "text-turmeric" : "";
  return <span className={`font-mono tabular-nums ${color} ${className}`}>{formatINR(amount)}</span>;
}

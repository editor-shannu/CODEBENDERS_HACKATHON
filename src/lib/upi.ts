export function upiLink(opts: { vpa: string; name: string; amount: number; note: string }): string {
  const p = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.name,
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note.slice(0, 50),
  });
  return `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
}

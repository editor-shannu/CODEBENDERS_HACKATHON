/** Paste & Match: reads a bank or UPI app SMS and finds the likeliest open invoice. Pure, so it is unit-tested. */
export type ParsedSms = { amount: number | null; utr: string | null; payer: string | null; vpa: string | null; date: string | null };

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function parseUpiSms(text: string, today: Date): ParsedSms {
  const t = text.replace(/\s+/g, " ");
  const amt = t.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) ?? t.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr|rupees)\b/i);
  const amount = amt ? Math.round(Number(amt[1].replace(/,/g, ""))) : null;
  const utrM = t.match(/(?:utr|upi ref(?:erence)?(?: no\.?)?|ref(?:erence)? ?(?:no\.?|number|id)?|txn ?(?:id|no\.?)?|rrn)[\s:.#-]*([A-Z0-9]{10,22})/i) ?? t.match(/\b(\d{12})\b/);
  const utr = utrM ? utrM[1] : null;
  const vpaM = t.match(/\b([a-z0-9._-]{2,})@([a-z]{2,})\b/i);
  const vpa = vpaM ? vpaM[0].toLowerCase() : null;
  const stop = String.raw`(?=\s+(?:on|via|vpa|upi|ref|utr|a\/c|ac|to|for)\b|[.,(@]|$)`;
  const payerM =
    t.match(new RegExp(String.raw`\bfrom\s+(?:vpa\s+)?([A-Za-z][A-Za-z .]{1,40}?)` + stop, "i")) ??
    t.match(new RegExp(String.raw`\b(?:credited by|sent by|by)\s+(?!upi\b)([A-Za-z][A-Za-z .]{1,40}?)` + stop, "i")) ??
    t.match(/UPI\/[A-Z0-9]+\/\d{9,}\/([A-Za-z][A-Za-z .]{1,40})/i);
  let payer = payerM ? payerM[1].trim() : null;
  if (payer && vpa && vpa.startsWith(payer.toLowerCase())) payer = null;
  if (payer && /^(upi|imps|neft|your|a\/c|account)$/i.test(payer)) payer = null;

  let date: string | null = null;
  const d1 = t.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  const d2 = t.match(/\b(\d{1,2})[- ]?([A-Za-z]{3})[a-z]*[- ,]?(\d{2,4})\b/);
  const mk = (d: number, m: number, y: number) => {
    const yy = y < 100 ? 2000 + y : y;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  if (d1) date = mk(Number(d1[1]), Number(d1[2]), Number(d1[3]));
  else if (d2 && MONTHS[d2[2].toLowerCase()]) date = mk(Number(d2[1]), MONTHS[d2[2].toLowerCase()], Number(d2[3]));
  const todayKey = today.toISOString().slice(0, 10);
  if (date && date > todayKey) date = todayKey;
  return { amount, utr, payer, vpa, date };
}

export type OpenInvoice = { invoiceId: string; familyId: string; parent: string; kids: string[]; balance: number; number: string; dueDate: string };

const tokens = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);

/** Scores each open invoice: amount match is the strongest signal, then payer or UPI ID matching the parent's or child's name. */
export function matchInvoices(p: ParsedSms, open: OpenInvoice[]): (OpenInvoice & { score: number; why: string[] })[] {
  const nameTokens = new Set([...(p.payer ? tokens(p.payer) : []), ...(p.vpa ? tokens(p.vpa.split("@")[0]) : [])]);
  return open
    .map((o) => {
      let score = 0;
      const why: string[] = [];
      if (p.amount !== null) {
        if (p.amount === o.balance) { score += 50; why.push("amount matches the balance"); }
        else if (p.amount < o.balance) { score += 15; why.push("part payment"); }
        else score -= 30;
      }
      const names = [...tokens(o.parent), ...o.kids.flatMap(tokens)];
      const hit = names.filter((n) => [...nameTokens].some((t) => t === n || (t.length >= 4 && (t.startsWith(n) || n.startsWith(t)))));
      if (hit.length) { score += 30 + 5 * (hit.length - 1); why.push(`name matches ${[...new Set(hit)].join(", ")}`); }
      return { ...o, score, why };
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score || a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
}

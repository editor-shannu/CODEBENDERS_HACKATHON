/** Voice Khata: turns a spoken note like "Ravi paid 1500 cash" into a payment draft. Pure, so it is unit-tested. */
export type KhataNote = { name: string | null; amount: number | null; mode: "CASH" | "UPI" | null };

const WORDS: Record<string, number> = { hundred: 100, thousand: 1000, sau: 100, hazaar: 1000, hazar: 1000, veyyi: 1000, vanda: 100 };
const SMALL: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, ek: 1, do: 2, teen: 3, char: 4, paanch: 5, das: 10 };

function spokenNumber(s: string): number | null {
  // "two thousand five hundred", "15 hundred", "1.5 thousand"
  const parts = s.toLowerCase().replace(/,/g, "").split(/\s+/);
  let total = 0, cur = 0, seen = false;
  for (const w of parts) {
    const n = Number(w);
    if (Number.isFinite(n) && w !== "") { cur += n; seen = true; continue; }
    if (SMALL[w] !== undefined) { cur += SMALL[w]; seen = true; continue; }
    if (WORDS[w]) { cur = (cur || 1) * WORDS[w]; if (WORDS[w] === 1000) { total += cur; cur = 0; } seen = true; continue; }
    if (seen && w === "and") continue;
    if (seen) break;
  }
  return seen ? total + cur : null;
}

export function parseKhata(text: string): KhataNote {
  const t = ` ${text.toLowerCase().replace(/[₹]/g, " rs ").replace(/(?<!\d)[.,]|[.,](?!\d)|[!?]/g, " ")} `;
  const mode = /\b(upi|gpay|google pay|phonepe|paytm|online)\b/.test(t) ? "UPI" : /\b(cash|nagadu|nakad|naqad|chillara)\b/.test(t) ? "CASH" : null;
  let amount: number | null = null;
  const digits = t.match(/(?:rs\s*)?(\d[\d,]*(?:\.\d+)?)\s*(thousand|hundred|k)?/);
  if (digits) {
    const n = Number(digits[1].replace(/,/g, ""));
    amount = Math.round(digits[2] === "thousand" || digits[2] === "k" ? n * 1000 : digits[2] === "hundred" ? n * 100 : n);
  } else {
    const m = t.match(/\b((?:one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|ek|do|teen|char|paanch|das)(?:\s+(?:thousand|hundred|and|one|two|three|four|five|six|seven|eight|nine|hazaar|hazar|sau))*)\b/);
    if (m) amount = spokenNumber(m[1]);
  }
  const nm = t.match(/^\s*([a-z][a-z]+(?:\s+[a-z][a-z]+)?)\s+(?:paid|gave|ichadu|ichindi|ichharu|icharu|kattadu|kattindi|ne|diya|di|de diya|pay chesadu|pay chesindi)\b/) ?? t.match(/\b(?:from|by)\s+([a-z][a-z]+)/);
  const name = nm ? nm[1].replace(/\b(rs|rupees)\b/g, "").trim() || null : null;
  return { name, amount: amount && amount > 0 ? amount : null, mode };
}

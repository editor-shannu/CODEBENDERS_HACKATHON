/**
 * Reads a WhatsApp chat export (Android "dd/mm/yy, 8:15 pm - Name: text" or iOS "[dd/mm/yyyy, 20:15:03] Name: text")
 * and turns the parents' group into families: who wrote, which children they mention, payments they reported
 * ("fee sent 1500 gpay") and promises ("next week pakka istanu"). Pure and offline, so it is unit tested.
 */

export type ChatMessage = { at: Date; sender: string; text: string };

export type ImportKid = { name: string; batch: string };
export type ImportPayment = { date: string; amount: number; text: string };
export type ImportCandidate = {
  sender: string;
  parentName: string;
  kids: ImportKid[];
  payments: ImportPayment[];
  promiseText: string | null;
  promiseAt: string | null; // YYYY-MM-DD of the message that made the promise
  language: "te" | "en" | "hi";
  messages: number;
  lastAt: string;
};

const ANDROID = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?\s+-\s+([^:]{1,60}?):\s([\s\S]*)$/i;
const IOS = /^\u200e?\[(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?\]\s+([^:]{1,60}?):\s([\s\S]*)$/i;
const SKIP = /^(<media omitted>|<attached:|image omitted|video omitted|sticker omitted|audio omitted|document omitted|gif omitted|this message was deleted|you deleted this message|null|missed voice call|missed video call|<this message was edited>)/i;

function clean(s: string) {
  return s.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\u202f|\u00a0/g, " ").trim();
}

/** Splits an export into messages. Continuation lines join the message above. System lines are dropped. */
export function parseChat(raw: string): ChatMessage[] {
  const lines = clean(raw).split(/\r?\n/);
  type Raw = { a: number; b: number; y: number; h: number; m: number; ap: string; sender: string; text: string };
  const rows: Raw[] = [];
  for (const line0 of lines) {
    const line = clean(line0);
    const m = ANDROID.exec(line) ?? IOS.exec(line);
    if (m) {
      rows.push({ a: +m[1], b: +m[2], y: +m[3], h: +m[4], m: +m[5], ap: (m[6] ?? "").toLowerCase().replace(/[.\s]/g, ""), sender: clean(m[7]), text: clean(m[8]) });
    } else if (rows.length && line) {
      rows[rows.length - 1].text += `\n${line}`;
    }
  }
  // Day-first unless the export proves otherwise (India uses dd/mm)
  const monthFirst = rows.some((r) => r.b > 12) && !rows.some((r) => r.a > 12);
  return rows
    .map((r) => {
      const day = monthFirst ? r.b : r.a;
      const month = monthFirst ? r.a : r.b;
      const year = r.y < 100 ? 2000 + r.y : r.y;
      let h = r.h;
      if (r.ap === "pm" && h < 12) h += 12;
      if (r.ap === "am" && h === 12) h = 0;
      // stored as the IST wall clock date at 00:00 UTC, the convention used across Baaki
      return { at: new Date(Date.UTC(year, month - 1, day, h, r.m)), sender: r.sender, text: r.text };
    })
    .filter((x) => !Number.isNaN(+x.at) && x.text && !SKIP.test(x.text));
}

const PAY_WORDS = /\b(paid|pay chesa\w*|pay chesanu|sent|send chesa\w*|transferred|transfer chesa\w*|deposited|done|credited|pampa\w*|pampinchanu|vesanu|vesa|kattanu|kattesa\w*|bhej\w*|kar diya|de diya|jama|gpay\w*|google pay|phone ?pe|paytm|upi)\b/i;
const FEE_WORDS = /\b(fee|fees|feez|amount|money|dabbulu|paisa|paise|tuition)\b|₹|\brs\.?\s?\d/i;
const PROMISE_WORDS = /\b(will pay|will send|pay chesta\w*|isthanu|istanu|ista|pamputa\w*|pampista\w*|kattesta\w*|de dunga|de denge|bhej dunga|bhej denge|kar dunga|tomorrow|repu|kal|next week|vachhe vaaram|agle hafte|salary|month end|ellundi|parso|pakka)\b/i;
const NOT_PAY = /\b(not|nahi|ledu|kaadu|cheyyaledu|won't|cant|can't)\b/i;

export function amountIn(text: string): number | null {
  const t = text.toLowerCase();
  const m = t.match(/(?:₹|rs\.?|inr)\s*([\d,]{3,7})/) ?? t.match(/\b([\d,]{3,7})\s*(?:\/-|rs\b|rupees|rupayalu|rupaye|only)/) ?? t.match(/\b(\d{3,5})\b/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return n >= 200 && n <= 50000 ? n : null;
}

const NAME = "([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)";
const KID_PATTERNS = [
  new RegExp(`\\b(?:my|our)\\s+(?:son|daughter|child|kid|boy|girl|baby)\\s+(?:is\\s+)?${NAME}`),
  new RegExp(`\\b${NAME}(?:'s|s)?\\s+(?:mother|father|mom|mum|dad|amma|nanna|papa|mummy|parent|ammi|abbu)\\b`),
  new RegExp(`\\b(?:mother|father|parent|amma|nanna)\\s+of\\s+${NAME}`),
  new RegExp(`\\b${NAME}\\s+(?:is\\s+)?(?:absent|sick|unwell|will not come|won't come|raadu|raledu|ki fever|ko fever|homework)`),
  new RegExp(`\\bfor\\s+${NAME}(?:'s)?\\s+(?:fee|fees|tuition)`),
  new RegExp(`\\b${NAME}(?:'s)?\\s+(?:fee|fees|tuition)\\b`),
];
const NOT_NAMES = new Set(["Sir", "Madam", "Mam", "Maam", "Teacher", "Good", "Thank", "Thanks", "Ok", "Okay", "Yes", "No", "Hi", "Hello", "Namaste", "Today", "Tomorrow", "The", "This", "Fee", "Fees", "Class", "Please", "Gpay", "Phonepe", "Paytm", "Done", "Sent", "Paid", "My", "Our", "Next", "Last", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Garu", "Gaaru", "Ji", "Bhai", "Anna", "Akka"]);

export function kidsIn(text: string): string[] {
  const out: string[] = [];
  for (const re of KID_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const name = m[1].split(" ").filter((w) => !NOT_NAMES.has(w)).join(" ");
      if (name.length >= 3 && !out.includes(name)) out.push(name);
    }
  }
  return out;
}

export function classIn(text: string): string | null {
  const t = text.toLowerCase();
  const m = t.match(/\b(?:class|std|standard|grade)\s*(\d{1,2})(?:st|nd|rd|th)?\b/) ?? t.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:class|std|standard|grade)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? `Class ${n}` : null;
}

export function languageOf(texts: string[]): "te" | "en" | "hi" {
  const all = texts.join(" ").toLowerCase();
  if (/[\u0C00-\u0C7F]/.test(all) || /\b(andi|garu|chesanu|istanu|isthanu|repu|ledu|cheppandi|vachhe|dabbulu)\b/.test(all)) return "te";
  if (/[\u0900-\u097F]/.test(all) || /\b(hai|nahi|kal|dunga|bhej|kar diya|ji|aap)\b/.test(all)) return "hi";
  return "en";
}

const looksLikePhone = (s: string) => /^\+?[\d\s()-]{8,}$/.test(s);
const toKey = (d: Date) => d.toISOString().slice(0, 10);

/** The tutor is usually the one who wrote most in the group. */
export function guessTutor(messages: ChatMessage[]): string | null {
  const count = new Map<string, number>();
  for (const m of messages) count.set(m.sender, (count.get(m.sender) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]);
  return top[0]?.[0] ?? null;
}

/** Groups the chat by sender (everyone except the tutor) and pulls out kids, classes, payments and the latest promise. */
export function buildCandidates(messages: ChatMessage[], tutor: string | null): ImportCandidate[] {
  const by = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    if (tutor && m.sender === tutor) continue;
    by.set(m.sender, [...(by.get(m.sender) ?? []), m]);
  }
  // the tutor sometimes names a child in reply ("Ravi's fee received, thank you"): credit it to the parent addressed nearby
  const out: ImportCandidate[] = [];
  for (const [sender, msgs] of by) {
    const kidNames: string[] = [];
    let batch: string | null = null;
    const payments: ImportPayment[] = [];
    let promiseText: string | null = null;
    let promiseAt: string | null = null;
    for (const m of msgs) {
      for (const k of kidsIn(m.text)) if (!kidNames.includes(k)) kidNames.push(k);
      batch = classIn(m.text) ?? batch;
      const amt = amountIn(m.text);
      if (PAY_WORDS.test(m.text) && !NOT_PAY.test(m.text) && !PROMISE_WORDS.test(m.text.replace(/\bpakka\b/i, "")) && (amt || FEE_WORDS.test(m.text))) {
        if (amt) payments.push({ date: toKey(m.at), amount: amt, text: m.text.slice(0, 140) });
      } else if (PROMISE_WORDS.test(m.text) && (FEE_WORDS.test(m.text) || /\b(pay|isthanu|istanu|pamputa\w*|de dunga|bhej)\b/i.test(m.text))) {
        promiseText = m.text.slice(0, 160);
        promiseAt = toKey(m.at);
      }
    }
    // a promise made before a later payment is already settled
    if (promiseAt && payments.some((p) => p.date >= promiseAt!)) {
      promiseText = null;
      promiseAt = null;
    }
    const parentName = looksLikePhone(sender) ? `Parent ${sender.replace(/\D/g, "").slice(-4)}` : sender.replace(/\s*\(.*?\)\s*/g, " ").trim();
    out.push({
      sender,
      parentName,
      kids: (kidNames.length ? kidNames : [""]).slice(0, 4).map((name) => ({ name, batch: batch ?? "" })),
      payments,
      promiseText,
      promiseAt,
      language: languageOf(msgs.map((m) => m.text)),
      messages: msgs.length,
      lastAt: toKey(msgs[msgs.length - 1].at),
    });
  }
  return out.sort((a, b) => b.messages - a.messages);
}

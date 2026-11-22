import "server-only";
import { addDays, formatDate, fromKey, toKey } from "../dates";
import { formatINR } from "../money";
import type { FamilyWithStats } from "../data";
import type { ForecastResult } from "../forecast";

/* ------------------------------------------------------------------ */
/* Reply Reader: turns a parent's WhatsApp reply into a payment promise */
/* ------------------------------------------------------------------ */

export type ReadReply = { promisedDate: string | null; amount: number | null; confidence: "high" | "medium" | "low"; summary: string; source: "AI" | "RULES" };

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, aadivaram: 0, ravivar: 0,
  monday: 1, mon: 1, somavaram: 1, somvar: 1,
  tuesday: 2, tue: 2, mangalavaram: 2, mangalvar: 2,
  wednesday: 3, wed: 3, budhavaram: 3, budhvar: 3,
  thursday: 4, thu: 4, guruvaram: 4, guruvar: 4,
  friday: 5, fri: 5, sukravaram: 5, shukravar: 5,
  saturday: 6, sat: 6, sanivaram: 6, shanivar: 6,
};

/** Works offline. Understands English, Tenglish and Hinglish ("sir next week pakka istanu", "kal de dunga", "repu isthanu"). */
export function parseReplyRules(text: string, today: Date, balance: number): ReadReply {
  const t = ` ${text.toLowerCase().replace(/[.,!?]/g, " ")} `;
  let date: Date | null = null;
  let why = "";

  if (/\b(today|ivala|ivvala|aaj|aj)\b/.test(t)) { date = today; why = "today"; }
  else if (/\b(day after tomorrow|ellundi|parso|parson)\b/.test(t)) { date = addDays(today, 2); why = "day after tomorrow"; }
  else if (/\b(tomorrow|tmrw|repu|kal|kaal)\b/.test(t)) { date = addDays(today, 1); why = "tomorrow"; }
  else if (/\b(next week|vachhe vaaram|vache varam|next varam|agle hafte|agla hafta)\b/.test(t)) { date = addDays(today, 7); why = "next week"; }
  else if (/\b(this week|ee vaaram|is hafte)\b/.test(t)) { date = addDays(today, Math.max(1, 6 - today.getUTCDay())); why = "end of this week"; }
  else if (/\b(month end|month-end|nela chivara|mahine ke end)\b/.test(t)) {
    date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)); why = "month end";
  } else if (/\b(salary|jeetham|tankha|tankhwah)\b/.test(t)) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 2));
    date = d > today ? d : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 2)); why = "after salary (assumed the 2nd)";
  }
  const days = t.match(/\b(\d{1,2})\s*(days|rojulu|din)\b/);
  if (!date && days) { date = addDays(today, Number(days[1])); why = `in ${days[1]} days`; }
  if (!date) {
    for (const [w, n] of Object.entries(WEEKDAYS)) {
      if (new RegExp(`\\b${w}\\b`).test(t)) {
        const diff = (n - today.getUTCDay() + 7) % 7 || 7;
        date = addDays(today, diff); why = w; break;
      }
    }
  }
  const nth = t.match(/\b(\d{1,2})(st|nd|rd|th)\b/) ?? t.match(/\b(?:on|by|tariku|tarikh|taareekh)\s+(\d{1,2})\b/);
  if (!date && nth) {
    const day = Number(nth[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), day));
      date = d >= today ? d : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, day)); why = `the ${day}${nth[2] ?? ""}`;
    }
  }

  let amount: number | null = null;
  const money = t.match(/(?:₹|rs\.?|inr)\s*([\d,]{3,})|\b([\d,]{3,})\s*(?:rs|rupees|rupayalu|rupaye)\b/);
  if (money) amount = Number((money[1] ?? money[2]).replace(/,/g, ""));
  else if (/\b(half|sagam|aadha)\b/.test(t)) amount = Math.round(balance / 2);
  if (date && !amount) amount = balance;

  const sure = /\b(pakka|sure|definitely|confirm|zaroor|pakka ga|kachitanga)\b/.test(t);
  const confidence = date ? (sure ? "high" : "medium") : "low";
  const summary = date
    ? `Promise to pay ${formatINR(amount ?? balance)} on ${formatDate(date)} (${why})${sure ? ", sounds sure" : ""}.`
    : "No clear payment date in this reply. Ask them for a date.";
  return { promisedDate: date ? toKey(date) : null, amount, confidence, summary, source: "RULES" };
}

/* ------------------------------------------------------------------ */
/* LLM plumbing (any OpenAI-compatible endpoint, Gemini by default)    */
/* ------------------------------------------------------------------ */

export const llmEnabled = () => Boolean(process.env.LLM_API_KEY);

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

async function chat(messages: Msg[], tools?: unknown[], json = false): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  const base = process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gemini-2.5-flash",
      messages,
      ...(tools ? { tools, tool_choice: "auto" } : {}),
      ...(json ? { response_format: { type: "json_object" } } : {}),
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message ?? { content: null };
}

export async function parseReply(text: string, today: Date, balance: number, parent: string): Promise<ReadReply> {
  const rules = parseReplyRules(text, today, balance);
  if (!llmEnabled()) return rules;
  try {
    const msg = await chat(
      [
        {
          role: "system",
          content: `You read WhatsApp replies from Indian parents about tuition fees. Replies may be English, Telugu, Hindi, or romanised Tenglish/Hinglish. Today is ${toKey(today)} (${formatDate(today)}). The family owes ${balance} rupees. Return JSON: {"promisedDate":"YYYY-MM-DD"|null,"amount":number|null,"confidence":"high"|"medium"|"low","summary":"one short English sentence"}.`,
        },
        { role: "user", content: `Reply from ${parent}: ${text}` },
      ],
      undefined,
      true,
    );
    const j = JSON.parse((msg.content ?? "{}").replace(/^```json|```$/g, ""));
    if (j.promisedDate && !/^\d{4}-\d{2}-\d{2}$/.test(j.promisedDate)) j.promisedDate = null;
    return { promisedDate: j.promisedDate ?? null, amount: j.amount ?? (j.promisedDate ? balance : null), confidence: j.confidence ?? "medium", summary: j.summary ?? rules.summary, source: "AI" };
  } catch {
    return rules;
  }
}

/* ------------------------------------------------------------------ */
/* Ask Munshi: agent loop with tool calls, rules fallback              */
/* ------------------------------------------------------------------ */

export type TraceStep = { kind: "think" | "tool" | "result" | "answer"; text: string };
export type AskResult = { answer: string; trace: TraceStep[]; source: "AI" | "RULES" };

type Ctx = { families: FamilyWithStats[]; forecast: ForecastResult; totalPending: number; today: Date };

function runTool(name: string, args: Record<string, unknown>, ctx: Ctx): unknown {
  const owing = ctx.families.filter((f) => f.stats.balance > 0);
  switch (name) {
    case "list_owing_families":
      return owing
        .sort((a, b) => b.stats.chaseScore - a.stats.chaseScore)
        .slice(0, Number(args.limit ?? 5))
        .map((f) => ({ parent: f.parentName, owes: f.stats.balance, daysLate: f.stats.oldestDaysLate, brokenPromises: f.stats.promisesBroken, suggestedTone: f.stats.suggestedTone }));
    case "get_totals":
      return { totalPending: ctx.totalPending, familiesOwing: owing.length, families: ctx.families.length };
    case "get_rent_risk":
      return ctx.forecast.rent
        ? { rentDate: ctx.forecast.rent.date, amount: ctx.forecast.rent.amount, riskOfShortfall: Math.round(ctx.forecast.rent.risk * 100) + "%", daysUntil: ctx.forecast.rent.daysUntil, runwayDays: ctx.forecast.runwayDays }
        : { note: "No rent bill set up" };
    case "get_family": {
      const q = String(args.name ?? "").toLowerCase();
      const f = ctx.families.find((x) => x.parentName.toLowerCase().includes(q) || x.students.some((s) => s.name.toLowerCase().includes(q)));
      if (!f) return { error: "No family matches that name" };
      return {
        parent: f.parentName,
        kids: f.students.map((s) => `${s.name} (${s.batch})`),
        owes: f.stats.balance,
        daysLate: f.stats.oldestDaysLate,
        avgDaysLateHistorically: Math.round(f.stats.avgDelay),
        promisesKept: f.stats.promisesKept,
        promisesBroken: f.stats.promisesBroken,
        openPromise: f.stats.openPromise ? { date: toKey(f.stats.openPromise.promisedDate), amount: f.stats.openPromise.amount } : null,
        notes: f.notes,
      };
    }
    default:
      return { error: "Unknown tool" };
  }
}

const TOOLS = [
  { type: "function", function: { name: "list_owing_families", description: "Families who owe fees, most urgent first", parameters: { type: "object", properties: { limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_totals", description: "Total pending fees and counts", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_rent_risk", description: "Chance of being short on rent day from the 500-run cash forecast", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_family", description: "Details for one family by parent or child name", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
];

function rulesAnswer(q: string, ctx: Ctx): AskResult {
  const s = q.toLowerCase();
  const trace: TraceStep[] = [{ kind: "think", text: "Offline mode: matching the question to a known tool." }];
  const call = (name: string, args: Record<string, unknown> = {}) => {
    trace.push({ kind: "tool", text: `${name}(${JSON.stringify(args)})` });
    const r = runTool(name, args, ctx);
    trace.push({ kind: "result", text: JSON.stringify(r).slice(0, 300) });
    return r as never;
  };
  let answer: string;
  const named = ctx.families.find((f) => s.includes(f.parentName.split(" ")[0].toLowerCase()) || f.students.some((k) => s.includes(k.name.split(" ")[0].toLowerCase())));
  if (named) {
    const r = call("get_family", { name: named.parentName }) as { parent: string; owes: number; daysLate: number; promisesBroken: number; avgDaysLateHistorically: number };
    answer = r.owes > 0
      ? `${r.parent} owes ${formatINR(r.owes)}, ${r.daysLate} days late. They usually pay about ${r.avgDaysLateHistorically} days late and have broken ${r.promisesBroken} promise(s). ${named.stats.suggestedTone === "GENTLE" ? "A gentle reminder should do." : `I'd send a ${named.stats.suggestedTone.toLowerCase()} reminder.`}`
      : `${r.parent} is fully paid up.`;
  } else if (/rent|short|runway|cash|forecast|afford/.test(s)) {
    const r = call("get_rent_risk") as { rentDate?: string; amount?: number; riskOfShortfall?: string; daysUntil?: number };
    answer = r.rentDate
      ? `Rent of ${formatINR(r.amount!)} is due ${formatDate(fromKey(r.rentDate))}, in ${r.daysUntil} days. There's a ${r.riskOfShortfall} chance you're short. Open the Rent Defense Plan to close the gap.`
      : "No rent bill is set up yet. Add one in Settings.";
  } else if (/total|pending|how much|kitna|entha/.test(s)) {
    const r = call("get_totals") as { totalPending: number; familiesOwing: number };
    answer = `${formatINR(r.totalPending)} is pending across ${r.familiesOwing} families.`;
  } else {
    const r = call("list_owing_families", { limit: 3 }) as { parent: string; owes: number; daysLate: number }[];
    answer = r.length ? `Chase these first: ${r.map((x) => `${x.parent} (${formatINR(x.owes)}, ${x.daysLate} days late)`).join("; ")}.` : "Nobody owes anything right now.";
  }
  trace.push({ kind: "answer", text: answer });
  return { answer, trace, source: "RULES" };
}

export async function askMunshi(question: string, ctx: Ctx): Promise<AskResult> {
  if (!llmEnabled()) return rulesAnswer(question, ctx);
  const trace: TraceStep[] = [];
  const messages: Msg[] = [
    {
      role: "system",
      content: `You are Munshi, the back-office clerk for a home tuition centre in India. Today is ${formatDate(ctx.today)} (IST). Use the tools to look up real numbers before answering. Answer in 1 to 3 short sentences, amounts in rupees with Indian grouping (₹14,500). Be practical and kind about parents.`,
    },
    { role: "user", content: question },
  ];
  try {
    for (let i = 0; i < 5; i++) {
      const msg = await chat(messages, TOOLS);
      if (msg.tool_calls?.length) {
        messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
          trace.push({ kind: "tool", text: `${tc.function.name}(${JSON.stringify(args)})` });
          const result = runTool(tc.function.name, args, ctx);
          trace.push({ kind: "result", text: JSON.stringify(result).slice(0, 300) });
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue;
      }
      const answer = msg.content?.trim() || "I couldn't work that out.";
      trace.push({ kind: "answer", text: answer });
      return { answer, trace, source: "AI" };
    }
    throw new Error("too many steps");
  } catch {
    const r = rulesAnswer(question, ctx);
    r.trace.unshift({ kind: "think", text: "AI unavailable, switched to offline rules." });
    return r;
  }
}

import "server-only";
import { addDays, formatDate, fromKey, toKey } from "../dates";
import { formatINR } from "../money";
import { reminderPayload, type FamilyWithStats } from "../data";
import { runForecast, type ForecastInput, type ForecastResult, type WhatIf } from "../forecast";
import type { Tone } from "../family-stats";
import { reminderText, waLink } from "../messages";
import { memoryOf, ordinal } from "./rules";
import { proposeOrRun, type WriteType } from "./execute";
import { allowedAmounts, checkAmounts, isThreatening, numbersIn } from "./guardrails";

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
          content: `You read WhatsApp replies from Indian parents about tuition fees. Replies may be English, Telugu, Hindi, or romanised Tenglish/Hinglish. Today is ${toKey(today)} (${formatDate(today)}). The family owes ${balance} rupees. Only report a date or amount the parent actually said; never invent one. Return JSON: {"promisedDate":"YYYY-MM-DD"|null,"amount":number|null,"confidence":"high"|"medium"|"low","summary":"one short English sentence"}.`,
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
export type ChartData =
  | { kind: "cash"; title: string; points: { date: string; before: number; after: number }[] }
  | { kind: "owed"; title: string; bars: { name: string; owed: number }[] };
export type AskResult = { answer: string; trace: TraceStep[]; source: "AI" | "RULES"; chart?: ChartData; actions?: { title: string; status: string }[] };

export type Ctx = {
  families: FamilyWithStats[];
  forecast: ForecastResult;
  input: ForecastInput;
  totalPending: number;
  today: Date;
  autonomy: string;
  centreName: string;
  tutorName: string;
  origin: string;
};

type ToolOut = { result: unknown; chart?: ChartData; action?: { title: string; status: string } };

function findFamily(ctx: Ctx, name: unknown) {
  const q = String(name ?? "").toLowerCase().trim();
  if (!q) return undefined;
  return ctx.families.find((x) => x.parentName.toLowerCase().includes(q) || x.students.some((s) => s.name.toLowerCase().includes(q)) || q.includes(x.parentName.split(" ")[0].toLowerCase()));
}

const isoDay = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Every tool Munshi can call. Read tools look things up; write tools go through the autonomy dial. */
async function runTool(name: string, args: Record<string, unknown>, ctx: Ctx, source: "AI" | "RULES"): Promise<ToolOut> {
  const owing = ctx.families.filter((f) => f.stats.balance > 0);
  const write = async (type: WriteType, familyId: string | null, title: string, payload: Record<string, unknown>, reason = "") => {
    const r = await proposeOrRun({ type, familyId, title, payload, reason, autonomy: ctx.autonomy, source });
    return { id: r.id, status: r.status === "DONE" ? "done" : "waiting for your approval", result: r.result };
  };
  switch (name) {
    case "list_owing_families":
      return {
        result: [...owing]
          .sort((a, b) => b.stats.chaseScore - a.stats.chaseScore)
          .slice(0, Number(args.limit ?? 5))
          .map((f) => ({ parent: f.parentName, owes: f.stats.balance, daysLate: f.stats.oldestDaysLate, brokenPromises: f.stats.promisesBroken, suggestedTone: f.stats.suggestedTone })),
      };
    case "get_totals":
      return {
        result: { totalPending: ctx.totalPending, familiesOwing: owing.length, families: ctx.families.length },
        chart: { kind: "owed", title: "Owed by family", bars: [...owing].sort((a, b) => b.stats.balance - a.stats.balance).slice(0, 8).map((f) => ({ name: f.parentName.split(" ")[0], owed: f.stats.balance })) },
      };
    case "get_rent_risk":
      return {
        result: ctx.forecast.rent
          ? { rentDate: ctx.forecast.rent.date, amount: ctx.forecast.rent.amount, riskOfShortfall: Math.round(ctx.forecast.rent.risk * 100) + "%", daysUntil: ctx.forecast.rent.daysUntil, runwayDays: ctx.forecast.runwayDays }
          : { note: "No rent bill set up" },
      };
    case "get_family": {
      const f = findFamily(ctx, args.name);
      if (!f) return { result: { error: "No family matches that name" } };
      return {
        result: {
          parent: f.parentName,
          language: f.language,
          kids: f.students.map((s) => `${s.name} (${s.batch})`),
          owes: f.stats.balance,
          daysLate: f.stats.oldestDaysLate,
          avgDaysLateHistorically: Math.round(f.stats.avgDelay),
          promisesKept: f.stats.promisesKept,
          promisesBroken: f.stats.promisesBroken,
          openPromise: f.stats.openPromise ? { date: toKey(f.stats.openPromise.promisedDate), amount: f.stats.openPromise.amount } : null,
          memory: memoryOf(f),
          notes: f.notes,
        },
      };
    }
    case "run_what_if": {
      const month = toKey(ctx.today).slice(0, 7);
      const w: WhatIf = {};
      if (Number(args.extraDelayDays)) {
        const f = args.family ? findFamily(ctx, args.family) : undefined;
        w.extraDelay = { familyId: f?.id ?? "ALL", days: Number(args.extraDelayDays) };
      }
      if (Number(args.loseStudents)) w.loseStudents = { count: Number(args.loseStudents), fromMonth: month };
      if (Number(args.feeRaise)) w.feeRaise = { amount: Number(args.feeRaise), fromMonth: month };
      if (Number(args.newStudents)) w.addStudents = { count: Number(args.newStudents), fee: Number(args.newStudentFee ?? 2000), fromMonth: month };
      const after = runForecast(ctx.input, w);
      const before = ctx.forecast;
      const pct = (r: number | undefined) => (r === undefined ? null : `${Math.round(r * 100)}%`);
      return {
        result: {
          scenario: w,
          rentRiskBefore: pct(before.rent?.risk),
          rentRiskAfter: pct(after.rent?.risk),
          runwayDaysBefore: before.runwayDays,
          runwayDaysAfter: after.runwayDays,
          likelyBalanceIn90DaysBefore: before.end90.p50,
          likelyBalanceIn90DaysAfter: after.end90.p50,
          expectedIn30Before: before.expectedIn30,
          expectedIn30After: after.expectedIn30,
        },
        chart: { kind: "cash", title: "Likely cash, before vs after", points: before.points.filter((_, i) => i % 3 === 0).map((p, i) => ({ date: p.date, before: p.p50, after: after.points[i * 3]?.p50 ?? p.p50 })) },
      };
    }
    case "draft_reminder": {
      const f = findFamily(ctx, args.name);
      if (!f) return { result: { error: "No family matches that name" } };
      if (f.stats.balance <= 0) return { result: { note: `${f.parentName} owes nothing, so no reminder is needed.` } };
      const tone = (["GENTLE", "FIRM", "FINAL"].includes(String(args.tone)) ? String(args.tone) : f.stats.suggestedTone) as Tone;
      const p = reminderPayload(f, { centreName: ctx.centreName, tutorName: ctx.tutorName }, ctx.today);
      const link = p.token ? `${ctx.origin}/pay/${p.token}` : ctx.origin;
      const raw = reminderText(f.language, tone, { parent: p.parent, kids: p.kids, centre: p.centre, tutor: p.tutor, amount: p.amount, months: p.months, days: p.days, by: p.by, link });
      const text = checkAmounts(raw, allowedAmounts(f));
      if (isThreatening(text)) return { result: { error: "Draft blocked by guardrail" } };
      const r = await write("REMIND", f.id, `Send a ${tone.toLowerCase()} reminder to ${f.parentName}`, { tone, language: f.language }, "Drafted by Munshi. Munshi never sends: you open WhatsApp and pick the chat.");
      return { result: { draft: text, whatsapp: waLink(text), language: f.language, sent: false, ...r }, action: { title: `Reminder draft for ${f.parentName}`, status: r.status } };
    }
    case "schedule_nudge": {
      const f = findFamily(ctx, args.name);
      if (!f) return { result: { error: "No family matches that name" } };
      const date = isoDay(args.date) ?? toKey(addDays(ctx.today, 1));
      if (date < toKey(ctx.today)) return { result: { error: "That date has passed" } };
      const tone = ["GENTLE", "FIRM", "FINAL"].includes(String(args.tone)) ? String(args.tone) : "GENTLE";
      const r = await write("NUDGE", f.id, `Nudge ${f.parentName} on ${formatDate(fromKey(date), { year: false })}`, { date, tone, language: f.language });
      return { result: { scheduledFor: date, tone, ...r }, action: { title: `Nudge ${f.parentName} on ${formatDate(fromKey(date), { year: false })}`, status: r.status } };
    }
    case "log_payment": {
      const f = findFamily(ctx, args.name);
      if (!f) return { result: { error: "No family matches that name" } };
      const amount = Math.round(Number(args.amount ?? f.stats.balance));
      if (!(amount > 0) || amount > f.stats.balance) return { result: { error: `Amount must be between 1 and ${f.stats.balance}, what ${f.parentName} owes` } };
      const mode = String(args.mode ?? "CASH").toUpperCase() === "UPI" ? "UPI" : "CASH";
      const r = await write("PAYMENT", f.id, `Record ${formatINR(amount)} ${mode.toLowerCase()} from ${f.parentName}`, { amount, mode });
      return { result: { proposal: true, amount, mode, ...r }, action: { title: `Record ${formatINR(amount)} from ${f.parentName}`, status: r.status } };
    }
    case "record_promise": {
      const f = findFamily(ctx, args.name);
      if (!f) return { result: { error: "No family matches that name" } };
      const date = isoDay(args.date);
      if (!date || date < toKey(ctx.today)) return { result: { error: "Need a promised date from today onwards (YYYY-MM-DD)" } };
      const amount = Math.min(f.stats.balance, Math.round(Number(args.amount ?? f.stats.balance))) || f.stats.balance;
      const r = await write("PROMISE", f.id, `${f.parentName} promised ${formatINR(amount)} by ${formatDate(fromKey(date), { year: false })}`, { date, amount, note: String(args.note ?? "") });
      return { result: { promisedDate: date, amount, ...r }, action: { title: `Promise from ${f.parentName}`, status: r.status } };
    }
    case "propose_due_date_change": {
      const f = findFamily(ctx, args.name);
      if (!f) return { result: { error: "No family matches that name" } };
      const dueDay = Math.round(Number(args.dueDay));
      if (!(dueDay >= 1 && dueDay <= 28)) return { result: { error: "Due day must be 1 to 28" } };
      const r = await write("DUE_DATE", f.id, `Move ${f.parentName}'s due date to the ${ordinal(dueDay)}`, { dueDay }, String(args.reason ?? ""));
      return { result: { proposal: true, dueDay, ...r }, action: { title: `Due date change for ${f.parentName}`, status: r.status } };
    }
    case "create_invoice": {
      const f = findFamily(ctx, args.name);
      if (!f) return { result: { error: "No family matches that name" } };
      const month = typeof args.month === "string" && /^\d{4}-\d{2}$/.test(args.month) ? args.month : toKey(ctx.today).slice(0, 7);
      if (f.invoices.some((i) => i.month === month)) return { result: { note: `${f.parentName} already has an invoice for ${month}` } };
      const r = await write("INVOICE", f.id, `Create a draft invoice for ${f.parentName} (${month}), ${formatINR(f.stats.monthlyTotal)}`, { month });
      return { result: { proposal: true, month, amount: f.stats.monthlyTotal, status: "DRAFT", approval: r.status }, action: { title: `Draft invoice for ${f.parentName}`, status: r.status } };
    }
    case "flag_risk": {
      const f = findFamily(ctx, args.name);
      if (!f) return { result: { error: "No family matches that name" } };
      const reason = String(args.reason ?? `${f.stats.oldestDaysLate} days late, ${f.stats.promisesBroken} broken promises`).slice(0, 200);
      const r = await write("FLAG", f.id, `Risk flagged: ${f.parentName}`, { reason }, reason);
      return { result: { flagged: true, reason, ...r }, action: { title: `Flagged ${f.parentName}`, status: r.status } };
    }
    default:
      return { result: { error: "Unknown tool" } };
  }
}

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
const S = { type: "string" };
const N = { type: "number" };

export const TOOLS = [
  fn("list_owing_families", "Families who owe fees, most urgent first", { limit: N }),
  fn("get_totals", "Total pending fees and counts", {}),
  fn("get_rent_risk", "Chance of being short on rent day from the 500-run cash forecast", {}),
  fn("get_family", "Details for one family by parent or child name", { name: S }, ["name"]),
  fn("run_what_if", "Re-run the 500-run cash forecast with changes and compare before vs after", { extraDelayDays: N, family: S, loseStudents: N, feeRaise: N, newStudents: N, newStudentFee: N }),
  fn("draft_reminder", "Draft a WhatsApp reminder in the family's language with the real amount. Never sends.", { name: S, tone: { type: "string", enum: ["GENTLE", "FIRM", "FINAL"] } }, ["name"]),
  fn("schedule_nudge", "Schedule a reminder nudge for a family on a date (YYYY-MM-DD)", { name: S, date: S, tone: S }, ["name"]),
  fn("log_payment", "Propose recording a payment a family made (needs the tutor's approval)", { name: S, amount: N, mode: { type: "string", enum: ["CASH", "UPI"] } }, ["name", "amount"]),
  fn("record_promise", "Record a family's promise to pay by a date (YYYY-MM-DD)", { name: S, date: S, amount: N, note: S }, ["name", "date"]),
  fn("propose_due_date_change", "Propose moving a family's monthly due day (1 to 28), needs approval", { name: S, dueDay: N, reason: S }, ["name", "dueDay"]),
  fn("create_invoice", "Create a DRAFT invoice for a family for a month (YYYY-MM), needs approval", { name: S, month: S }, ["name"]),
  fn("flag_risk", "Flag a family as a collection risk with a short reason", { name: S, reason: S }, ["name"]),
];

/* ---------- offline rules: keyword matching onto the same tools ---------- */

const num = (s: string, re: RegExp) => {
  const m = s.match(re);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
};

async function rulesAnswer(q: string, ctx: Ctx): Promise<AskResult> {
  const s = ` ${q.toLowerCase()} `;
  const trace: TraceStep[] = [{ kind: "think", text: "Offline mode: matching the question to a known tool." }];
  let chart: ChartData | undefined;
  const actions: { title: string; status: string }[] = [];
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    trace.push({ kind: "tool", text: `${name}(${JSON.stringify(args)})` });
    const r = await runTool(name, args, ctx, "RULES");
    trace.push({ kind: "result", text: JSON.stringify(r.result).slice(0, 300) });
    if (r.chart) chart = r.chart;
    if (r.action) actions.push(r.action);
    return r.result as never;
  };
  const named = ctx.families.find((f) => s.includes(f.parentName.split(" ")[0].toLowerCase()) || f.students.some((k) => s.includes(` ${k.name.split(" ")[0].toLowerCase()}`)));
  const amount = num(s, /(?:₹|rs\.?\s*|inr\s*)([\d,]{2,})/) || num(s, /\b([\d,]{3,})\b/);
  const when = () => parseReplyRules(q, ctx.today, named?.stats.balance ?? 0).promisedDate;
  const tone = /final|last/.test(s) ? "FINAL" : /firm|strict/.test(s) ? "FIRM" : /gentle|soft|polite/.test(s) ? "GENTLE" : undefined;
  let answer: string;

  if (/what if|what-if|suppose|scenario|\bif (i|we)\b|lose|drop ?out|raise|hike|new (student|admission)|admissions?|pay late|days late/.test(s) && !/(promise|paid|received)/.test(s)) {
    const args: Record<string, unknown> = {};
    const late = num(s, /(\d+)\s*(?:more\s*)?days?\s*(?:late|delay)/);
    if (late) args.extraDelayDays = late;
    if (late && named) args.family = named.parentName;
    const lose = num(s, /(?:lose|loses|drop|dropout of|leave)\s*(\d+)/) || (/(lose|drop ?out|leaves?)/.test(s) ? 1 : 0);
    if (lose) args.loseStudents = lose;
    const raise = num(s, /(?:raise|hike|increase)[^\d]*(\d+)/) || num(s, /fee\s*\+\s*(\d+)/);
    if (raise) args.feeRaise = raise;
    const add = num(s, /(\d+)\s*new\s*(?:student|admission|kid)/);
    if (add) args.newStudents = add;
    if (!Object.keys(args).length) args.extraDelayDays = 7;
    const r = (await call("run_what_if", args)) as { rentRiskBefore: string | null; rentRiskAfter: string | null; runwayDaysBefore: number; runwayDaysAfter: number; likelyBalanceIn90DaysBefore: number; likelyBalanceIn90DaysAfter: number };
    const risk = r.rentRiskBefore ? ` Rent risk goes from ${r.rentRiskBefore} to ${r.rentRiskAfter}.` : "";
    answer = `In 90 days your likely balance would be ${formatINR(r.likelyBalanceIn90DaysAfter)} instead of ${formatINR(r.likelyBalanceIn90DaysBefore)}.${risk} Runway: ${r.runwayDaysAfter >= 90 ? "90+" : r.runwayDaysAfter} days (was ${r.runwayDaysBefore >= 90 ? "90+" : r.runwayDaysBefore}).`;
  } else if (named && /draft|write|message|whatsapp|remind(er)? text|compose/.test(s)) {
    const r = (await call("draft_reminder", { name: named.parentName, ...(tone ? { tone } : {}) })) as { draft?: string; note?: string; status?: string };
    answer = r.draft ? `Here's a draft for ${named.parentName}. I haven't sent it; it's ${r.status}.\n\n${r.draft}` : r.note ?? "I couldn't draft that.";
  } else if (named && /nudge|follow ?up|remind .*(on|tomorrow|kal|repu|next)|schedule/.test(s)) {
    const date = when();
    const r = (await call("schedule_nudge", { name: named.parentName, ...(date ? { date } : {}), ...(tone ? { tone } : {}) })) as { scheduledFor?: string; status?: string; error?: string };
    answer = r.scheduledFor ? `Nudge for ${named.parentName} on ${formatDate(fromKey(r.scheduledFor))}: ${r.status}.` : r.error ?? "I couldn't schedule that.";
  } else if (named && /promis|will pay|istanu|isthanu|de dunga|pay by/.test(s)) {
    const date = when();
    if (!date) answer = `When did ${named.parentName} promise to pay? Say a day, like "promised Friday".`;
    else {
      const r = (await call("record_promise", { name: named.parentName, date, ...(amount ? { amount } : {}) })) as { promisedDate?: string; amount?: number; status?: string; error?: string };
      answer = r.promisedDate ? `Promise from ${named.parentName}: ${formatINR(r.amount!)} by ${formatDate(fromKey(r.promisedDate))}, ${r.status}.` : r.error ?? "I couldn't record that.";
    }
  } else if (named && /\b(paid|received|got|gave|collected)\b/.test(s)) {
    const mode = /upi|gpay|phonepe|paytm/.test(s) ? "UPI" : "CASH";
    const r = (await call("log_payment", { name: named.parentName, amount: amount || named.stats.balance, mode })) as { amount?: number; status?: string; error?: string };
    answer = r.amount ? `Payment of ${formatINR(r.amount)} from ${named.parentName} is ${r.status}. Money actions always need your tap.` : r.error ?? "I couldn't log that.";
  } else if (named && /due (date|day)|move .*due|change .*due/.test(s)) {
    const day = num(s, /(\d{1,2})(?:st|nd|rd|th)?\b/);
    const r = (await call("propose_due_date_change", { name: named.parentName, dueDay: day })) as { dueDay?: number; status?: string; error?: string };
    answer = r.dueDay ? `Proposed: ${named.parentName}'s due date moves to the ${ordinal(r.dueDay)}. It's ${r.status}.` : r.error ?? "Which day of the month? 1 to 28.";
  } else if (named && /invoice|bill (them|her|him)/.test(s)) {
    const r = (await call("create_invoice", { name: named.parentName })) as { month?: string; amount?: number; approval?: string; note?: string; error?: string };
    answer = r.month ? `Draft invoice for ${named.parentName}, ${formatINR(r.amount!)} for ${r.month}: ${r.approval}.` : r.note ?? r.error ?? "I couldn't create that.";
  } else if (named && /risk|flag|worried|concern/.test(s)) {
    const r = (await call("flag_risk", { name: named.parentName })) as { reason?: string };
    answer = `Flagged ${named.parentName} as a risk: ${r.reason}.`;
  } else if (named) {
    const r = (await call("get_family", { name: named.parentName })) as { parent: string; owes: number; daysLate: number; promisesBroken: number; avgDaysLateHistorically: number };
    answer = r.owes > 0
      ? `${r.parent} owes ${formatINR(r.owes)}, ${r.daysLate} days late. They usually pay about ${r.avgDaysLateHistorically} days late and have broken ${r.promisesBroken} promise(s). ${named.stats.suggestedTone === "GENTLE" ? "A gentle reminder should do." : `I'd send a ${named.stats.suggestedTone.toLowerCase()} reminder.`}`
      : `${r.parent} is fully paid up.`;
  } else if (/rent|short|runway|cash|forecast|afford/.test(s)) {
    const r = (await call("get_rent_risk")) as { rentDate?: string; amount?: number; riskOfShortfall?: string; daysUntil?: number };
    answer = r.rentDate
      ? `Rent of ${formatINR(r.amount!)} is due ${formatDate(fromKey(r.rentDate))}, in ${r.daysUntil} days. There's a ${r.riskOfShortfall} chance you're short. Open the Rent Defense Plan to close the gap.`
      : "No rent bill is set up yet. Add one in Settings.";
  } else if (/total|pending|how much|kitna|entha|owed|outstanding/.test(s)) {
    const r = (await call("get_totals")) as { totalPending: number; familiesOwing: number };
    answer = `${formatINR(r.totalPending)} is pending across ${r.familiesOwing} families.`;
  } else {
    const r = (await call("list_owing_families", { limit: 3 })) as { parent: string; owes: number; daysLate: number }[];
    answer = r.length ? `Chase these first: ${r.map((x) => `${x.parent} (${formatINR(x.owes)}, ${x.daysLate} days late)`).join("; ")}.` : "Nobody owes anything right now.";
  }
  trace.push({ kind: "answer", text: answer });
  return { answer, trace, source: "RULES", chart, actions };
}

export async function askMunshi(question: string, ctx: Ctx): Promise<AskResult> {
  if (!llmEnabled()) return rulesAnswer(question, ctx);
  const trace: TraceStep[] = [];
  let chart: ChartData | undefined;
  const actions: { title: string; status: string }[] = [];
  const results: unknown[] = [];
  const messages: Msg[] = [
    { role: "system", content: munshiSystemPrompt(ctx) },
    { role: "user", content: question },
  ];
  try {
    for (let i = 0; i < 6; i++) {
      const msg = await chat(messages, TOOLS);
      if (msg.tool_calls?.length) {
        messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
          trace.push({ kind: "tool", text: `${tc.function.name}(${JSON.stringify(args)})` });
          const out = await runTool(tc.function.name, args, ctx, "AI");
          if (out.chart) chart = out.chart;
          if (out.action) actions.push(out.action);
          trace.push({ kind: "result", text: JSON.stringify(out.result).slice(0, 300) });
          results.push(out.result);
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out.result) });
        }
        continue;
      }
      let answer = msg.content?.trim() || "I couldn't work that out.";
      // Guardrails: rupee amounts must come from tool results; threats or shaming are never shown.
      const checked = checkAmounts(answer, numbersIn(results));
      if (checked !== answer) trace.push({ kind: "think", text: "Guardrail: dropped an amount that no tool returned." });
      answer = checked;
      if (isThreatening(answer)) {
        trace.push({ kind: "think", text: "Guardrail: the AI answer used threatening or shaming words, switched to offline rules." });
        if (!actions.length) {
          const r = await rulesAnswer(question, ctx);
          return { ...r, trace: [...trace, ...r.trace] };
        }
        answer = `Done: ${actions.map((a) => `${a.title} (${a.status})`).join("; ")}.`;
      }
      trace.push({ kind: "answer", text: answer });
      return { answer, trace, source: "AI", chart, actions };
    }
    throw new Error("too many steps");
  } catch {
    if (actions.length) {
      // writes already happened: don't repeat them through the rules
      const answer = `Done: ${actions.map((a) => `${a.title} (${a.status})`).join("; ")}.`;
      trace.push({ kind: "answer", text: answer });
      return { answer, trace, source: "AI", chart, actions };
    }
    const r = await rulesAnswer(question, ctx);
    r.trace.unshift({ kind: "think", text: "AI unavailable, switched to offline rules." });
    return r;
  }
}

/** Munshi's system prompt (also quoted in the README). */
export function munshiSystemPrompt(ctx: Pick<Ctx, "today" | "centreName" | "autonomy">): string {
  return [
    `You are Munshi, the back-office clerk for ${ctx.centreName}, a home tuition centre in Hyderabad, India. Today is ${formatDate(ctx.today)} (IST).`,
    "Use the tools to look up real numbers before answering. Every amount and date you state must come from a tool result in this conversation; never invent or estimate one.",
    "Answer in 1 to 3 short sentences, amounts in rupees with Indian grouping (₹14,500).",
    "Be practical and kind about parents. Never threaten, shame, or pressure a family, and never suggest stopping a child's classes as a punishment.",
    "Never share one family's fees, promises or notes in a message meant for another family.",
    "Reminders are drafts in the family's own language (te, hi or en); you never send them. The tutor sends from WhatsApp.",
    `The autonomy dial is ${ctx.autonomy}. Write tools may land in the approval inbox; say so when they do. Money actions (payments, invoices, due dates) always wait for the tutor.`,
  ].join(" ");
}

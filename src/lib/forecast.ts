import { addDays, addMonths, dateInMonth, daysBetween, fromKey, monthKey, monthStart, toKey } from "./dates";
import { mulberry32 } from "./rng";

export type ForecastFamily = {
  id: string;
  name: string;
  monthlyTotal: number;
  dueDay: number;
  studentCount: number;
  delays: number[];
  avgDelay: number;
  promiseScore: number;
  openPromise: { date: string; amount: number } | null;
  unpaid: { amount: number; dueDate: string }[];
};

export type ForecastInput = {
  today: string;
  startingBalance: number;
  families: ForecastFamily[];
  bills: { name: string; amount: number; dueDay: number; deferDays: number }[];
  keyDates: { name: string; start: string; end: string; factor: number }[];
};

export type WhatIf = {
  extraDelay?: { familyId: string | "ALL"; days: number; familyIds?: string[] };
  loseStudents?: { count: number; fromMonth: string };
  feeRaise?: { amount: number; fromMonth: string };
  addStudents?: { count: number; fee: number; fromMonth: string };
};

export type ForecastPoint = { date: string; day: number; p10: number; p50: number; p90: number };

export type ForecastResult = {
  points: ForecastPoint[];
  rent: { name: string; date: string; amount: number; risk: number; daysUntil: number } | null;
  runwayDays: number; // days until the likely (P50) balance first goes negative; horizon+ if never
  weeks: { start: string; end: string; weather: "SUNNY" | "CLOUDY" | "STORM"; inflow: number; outflow: number }[];
  payBeforeRent: Record<string, number>; // probability each family clears their dues before rent day
  expectedIn30: number;
  end90: { p10: number; p50: number; p90: number };
};

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];

export function runForecast(input: ForecastInput, whatIf: WhatIf = {}, opts: { horizon?: number; runs?: number; seed?: number } = {}): ForecastResult {
  const H = opts.horizon ?? 90;
  const RUNS = opts.runs ?? 500;
  const seed0 = opts.seed ?? 20261121;
  // Common random numbers: each family gets its own stream per run, so a what-if on one family
  // never reshuffles the draws of the others (before vs after compares like with like).
  const hashStr = (str: string) => { let h = 2166136261; for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619); return h >>> 0; };
  let rand = mulberry32(seed0);
  const today = fromKey(input.today);
  const dayIdx = (d: Date) => daysBetween(today, d);

  // Bills (deterministic outflows)
  const outflow = new Array(H + 1).fill(0);
  const billEvents: { name: string; date: Date; amount: number }[] = [];
  for (let m = 0; m <= Math.ceil(H / 28) + 1; m++) {
    const month = monthKey(addMonths(monthStart(today), m));
    for (const b of input.bills) {
      const date = addDays(dateInMonth(month, b.dueDay), b.deferDays);
      const i = dayIdx(date);
      if (i >= 0 && i <= H) {
        outflow[i] += b.amount;
        billEvents.push({ name: b.name, date, amount: b.amount });
      }
    }
  }
  billEvents.sort((a, b) => +a.date - +b.date);
  const rentBill =
    input.bills.find((b) => /rent/i.test(b.name)) ?? [...input.bills].sort((a, b) => b.amount - a.amount)[0] ?? null;
  const rentEvent = rentBill ? billEvents.find((e) => e.name === rentBill.name) ?? null : null;
  const rentIdx = rentEvent ? dayIdx(rentEvent.date) : -1;

  const periods = input.keyDates.map((k) => ({ s: dayIdx(fromKey(k.start)), e: dayIdx(fromKey(k.end)), f: k.factor }));
  const shiftForHolidays = (i: number) => {
    for (const p of periods) if (i >= p.s && i <= p.e && rand() > p.f) return p.e + 1 + Math.floor(rand() * 5);
    return i;
  };

  const extraFor = (fid: string) =>
    whatIf.extraDelay && (whatIf.extraDelay.familyId === "ALL" || whatIf.extraDelay.familyId === fid || !!whatIf.extraDelay.familyIds?.includes(fid)) ? whatIf.extraDelay.days : 0;

  const futureMonths: string[] = [];
  for (let m = 1; m <= Math.ceil(H / 28) + 1; m++) futureMonths.push(monthKey(addMonths(monthStart(today), m)));

  const totalStudents = input.families.reduce((s, f) => s + f.studentCount, 0) || 1;
  const avgFee = input.families.reduce((s, f) => s + f.monthlyTotal, 0) / totalStudents;

  const balances: number[][] = Array.from({ length: H + 1 }, () => []);
  const clearedBeforeRent: Record<string, number> = {};
  let in30Sum = 0;

  for (let r = 0; r < RUNS; r++) {
    const inflow = new Array(H + 1).fill(0);
    const add = (i: number, amt: number) => {
      if (i < 0) i = 0;
      if (i <= H && amt > 0) inflow[i] += amt;
    };

    for (const f of input.families) {
      rand = mulberry32((seed0 ^ hashStr(f.id)) + r * 7919);
      const extra = extraFor(f.id);
      const sampleDelay = () => {
        const base = f.delays.length ? f.delays[Math.floor(rand() * f.delays.length)] : 7;
        return Math.max(-3, base + Math.floor(rand() * 6) - 2 + extra);
      };
      let lastPayIdx = -1;
      let usedPromise = false;
      for (const u of f.unpaid) {
        const due = fromKey(u.dueDate);
        let i: number;
        if (!usedPromise && f.openPromise && rand() < f.promiseScore) {
          i = Math.max(0, dayIdx(fromKey(f.openPromise.date))) + extra;
          usedPromise = true;
        } else {
          i = dayIdx(addDays(due, sampleDelay()));
          if (i <= 0) {
            // already late: pays some time from now, slower for habitual late payers
            if (f.avgDelay > 30 && rand() < 0.15) continue; // may not pay within the horizon
            i = 1 + Math.floor(rand() * Math.max(4, f.avgDelay * 0.8)) + extra;
          }
        }
        i = shiftForHolidays(i);
        add(i, u.amount);
        lastPayIdx = Math.max(lastPayIdx, i);
      }
      if (rentIdx >= 0 && f.unpaid.length && lastPayIdx >= 0 && lastPayIdx < rentIdx) clearedBeforeRent[f.id] = (clearedBeforeRent[f.id] ?? 0) + 1;

      for (const month of futureMonths) {
        let amount = f.monthlyTotal;
        if (whatIf.feeRaise && month >= whatIf.feeRaise.fromMonth) amount += whatIf.feeRaise.amount * f.studentCount;
        const i = shiftForHolidays(dayIdx(addDays(dateInMonth(month, f.dueDay), sampleDelay())));
        add(i, amount);
      }
    }

    // Whole-centre scenarios
    rand = mulberry32(seed0 + r * 104729 + 1);
    for (const month of futureMonths) {
      const i = dayIdx(dateInMonth(month, 10));
      if (whatIf.loseStudents && month >= whatIf.loseStudents.fromMonth && i >= 0 && i <= H) {
        inflow[i] -= Math.round(whatIf.loseStudents.count * avgFee);
      }
      if (whatIf.addStudents && month >= whatIf.addStudents.fromMonth) add(i + Math.floor(rand() * 8), whatIf.addStudents.count * whatIf.addStudents.fee);
    }

    let bal = input.startingBalance;
    for (let d = 0; d <= H; d++) {
      bal += inflow[d] - outflow[d];
      balances[d].push(bal);
      if (d <= 30) in30Sum += inflow[d];
    }
  }

  const points: ForecastPoint[] = balances.map((arr, d) => {
    const s = [...arr].sort((a, b) => a - b);
    return { date: toKey(addDays(today, d)), day: d, p10: Math.round(quantile(s, 0.1)), p50: Math.round(quantile(s, 0.5)), p90: Math.round(quantile(s, 0.9)) };
  });

  let runwayDays = H + 1;
  for (const p of points) if (p.p50 < 0) { runwayDays = p.day; break; }

  let rent: ForecastResult["rent"] = null;
  if (rentEvent && rentIdx >= 0) {
    const atRent = balances[rentIdx];
    const risk = atRent.filter((b) => b < 0).length / atRent.length;
    rent = { name: rentEvent.name, date: toKey(rentEvent.date), amount: rentEvent.amount, risk, daysUntil: rentIdx };
  }

  const weeks: ForecastResult["weeks"] = [];
  for (let w = 0; w < 6; w++) {
    const s = w * 7 + 1, e = Math.min(H, w * 7 + 7);
    const slice = points.slice(s, e + 1);
    const minP50 = Math.min(...slice.map((p) => p.p50));
    const minP10 = Math.min(...slice.map((p) => p.p10));
    const inflowMean = Math.round(slice.reduce((acc, p, k) => acc + Math.max(0, p.p50 - (k === 0 ? points[s - 1].p50 : slice[k - 1].p50) + outflow[p.day]), 0));
    const out = slice.reduce((acc, p) => acc + outflow[p.day], 0);
    weeks.push({
      start: slice[0].date,
      end: slice[slice.length - 1].date,
      weather: minP50 < 0 ? "STORM" : minP10 < 0 ? "CLOUDY" : "SUNNY",
      inflow: inflowMean,
      outflow: out,
    });
  }

  const payBeforeRent: Record<string, number> = {};
  for (const f of input.families) if (f.unpaid.length) payBeforeRent[f.id] = (clearedBeforeRent[f.id] ?? 0) / RUNS;

  const last = points[points.length - 1];
  return { points, rent, runwayDays, weeks, payBeforeRent, expectedIn30: Math.round(in30Sum / RUNS), end90: { p10: last.p10, p50: last.p50, p90: last.p90 } };
}

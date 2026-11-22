import { describe, expect, it } from "vitest";
import { parseReplyRules } from "../src/lib/munshi/agent";
import { learnedDay, ordinal, goalSuggestion } from "../src/lib/munshi/rules";
import { canAutoRun } from "../src/lib/munshi/execute";
import { fromKey } from "../src/lib/dates";
import type { ForecastResult } from "../src/lib/forecast";

const today = fromKey("2026-11-22"); // a Sunday

describe("Reply Reader offline rules", () => {
  it("reads Tenglish and Hinglish dates", () => {
    expect(parseReplyRules("sir next week pakka istanu", today, 1800)).toMatchObject({ promisedDate: "2026-11-29", amount: 1800, confidence: "high" });
    expect(parseReplyRules("kal de dunga sir", today, 1800).promisedDate).toBe("2026-11-23");
    expect(parseReplyRules("repu isthanu", today, 1800).promisedDate).toBe("2026-11-23");
    expect(parseReplyRules("Will pay 1500 rs on Friday madam", today, 2200)).toMatchObject({ promisedDate: "2026-11-27", amount: 1500 });
  });
  it("asks for a date when there is none", () => {
    const r = parseReplyRules("ok sir", today, 1800);
    expect(r.promisedDate).toBeNull();
    expect(r.confidence).toBe("low");
  });
});

describe("rules helpers", () => {
  it("ordinals and learned pay day", () => {
    expect([1, 2, 3, 4, 11, 21, 22].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "21st", "22nd"]);
    expect(learnedDay({ salaryDay: "Pays after salary, around the 5th" })).toBe(5);
    expect(learnedDay({ usualPayDay: "18th" })).toBe(18);
    expect(learnedDay({})).toBeNull();
  });
  it("goal suggestion picks families until the gap closes", () => {
    const fam = (id: string, name: string, balance: number) => ({ id, parentName: name, stats: { balance, promiseScore: 0.5 } }) as never;
    const forecast = { payBeforeRent: { a: 0.9, b: 0.1 } } as unknown as ForecastResult;
    const r = goalSuggestion({ families: [fam("a", "Anitha V", 1800), fam("b", "Suresh A", 2800)], forecast, gap: 1500 });
    expect(r.familyIds).toEqual(["a"]);
    expect(goalSuggestion({ families: [], forecast, gap: 0 }).familyIds).toEqual([]);
  });
});

describe("autonomy dial", () => {
  it("never auto-runs money actions", () => {
    for (const t of ["PAYMENT", "INVOICE", "DUE_DATE"]) expect(canAutoRun(t, "AUTO")).toBe(false);
  });
  it("ASK and SUGGEST send everything to the inbox", () => {
    for (const mode of ["ASK", "SUGGEST"]) for (const t of ["REMIND", "NUDGE", "PROMISE", "FLAG"]) expect(canAutoRun(t, mode)).toBe(false);
  });
  it("AUTO runs low-risk actions, but only gentle reminders", () => {
    expect(canAutoRun("NUDGE", "AUTO")).toBe(true);
    expect(canAutoRun("PROMISE", "AUTO")).toBe(true);
    expect(canAutoRun("REMIND", "AUTO", { tone: "GENTLE" })).toBe(true);
    expect(canAutoRun("REMIND", "AUTO", { tone: "FINAL" })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { runForecast, type ForecastInput } from "../src/lib/forecast";

const input: ForecastInput = {
  today: "2026-11-22",
  startingBalance: 5000,
  families: [
    { id: "a", name: "A", monthlyTotal: 2000, dueDay: 5, studentCount: 1, delays: [0, 2, 1], avgDelay: 1, promiseScore: 0.8, openPromise: null, unpaid: [] },
    { id: "b", name: "B", monthlyTotal: 2500, dueDay: 10, studentCount: 1, delays: [12, 20], avgDelay: 16, promiseScore: 0.3, openPromise: { date: "2026-11-25", amount: 2500 }, unpaid: [{ amount: 2500, dueDate: "2026-11-10" }] },
  ],
  bills: [{ name: "Rent", amount: 8000, dueDay: 5, deferDays: 0 }],
  keyDates: [],
};

describe("forecast", () => {
  it("is deterministic with the seeded rng", () => {
    const a = runForecast(input);
    const b = runForecast(input);
    expect(a).toEqual(b);
    expect(a.points.length).toBe(91);
  });
  it("changes with a different seed but keeps its shape", () => {
    const c = runForecast(input, {}, { seed: 7 });
    expect(c.points.length).toBe(91);
    for (const p of c.points) expect(p.p10).toBeLessThanOrEqual(p.p90);
  });
  it("what-if delays make things no better", () => {
    const base = runForecast(input);
    const late = runForecast(input, { extraDelay: { familyId: "ALL", days: 20 } });
    expect(late.end90.p50).toBeLessThanOrEqual(base.end90.p50);
    expect(late.rent?.risk ?? 0).toBeGreaterThanOrEqual(base.rent?.risk ?? 0);
  });
});

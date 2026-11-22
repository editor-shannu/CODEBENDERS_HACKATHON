import { describe, expect, it } from "vitest";
import { allowedAmounts, checkAmounts, isThreatening, numbersIn } from "../src/lib/munshi/guardrails";

describe("guardrail amount check", () => {
  const f = { stats: { balance: 2800, monthlyTotal: 1800, unpaid: [{ amount: 1800, payments: [] }, { amount: 1800, payments: [{ amount: 800 }] }], openPromise: { amount: 1000 } } };
  it("allows only database amounts", () => {
    expect(allowedAmounts(f).sort((a, b) => a - b)).toEqual([1000, 1800, 2800]);
  });
  it("keeps real amounts and drops invented ones", () => {
    expect(checkAmounts("Fee of ₹2,800 is pending", [2800])).toBe("Fee of ₹2,800 is pending");
    expect(checkAmounts("Fee of ₹5,000 is pending", [2800])).toBe("Fee of is pending");
    expect(checkAmounts("Pay Rs. 1800 or ₹99", [1800])).toBe("Pay Rs. 1800 or ");
  });
  it("collects numbers from tool results", () => {
    expect(numbersIn([{ owes: 2800, list: [{ x: "₹1,800" }] }])).toEqual(expect.arrayContaining([2800, 1800]));
  });
  it("flags threats and shaming", () => {
    expect(isThreatening("We will take legal action")).toBe(true);
    expect(isThreatening("Pay or we stop classes")).toBe(true);
    expect(isThreatening("A gentle reminder, thank you!")).toBe(false);
  });
});

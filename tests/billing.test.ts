import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { effectivePlan, extendUntil, isPlanKey, PLANS } from "../src/lib/billing/plans";
import { verifySignature } from "../src/lib/billing/razorpay";

describe("billing", () => {
  it("prices come from the server table, not the client", () => {
    expect(PLANS.PRO_MONTH.rupees).toBe(99);
    expect(PLANS.PRO_YEAR.rupees).toBe(999);
    expect(isPlanKey("PRO_MONTH")).toBe(true);
    expect(isPlanKey("FREE_FOREVER_PRO")).toBe(false);
  });
  it("a paid plan past its end date counts as Free", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    expect(effectivePlan({ plan: "PRO", planUntil: new Date("2026-12-22") }, now)).toBe("PRO");
    expect(effectivePlan({ plan: "PRO", planUntil: new Date("2026-11-01") }, now)).toBe("FREE");
    expect(effectivePlan(null, now)).toBe("FREE");
  });
  it("renewing early adds days on top of the current end date", () => {
    const now = new Date("2026-11-22T00:00:00Z");
    expect(extendUntil(new Date("2026-12-01T00:00:00Z"), 30, now).toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(extendUntil(null, 30, now).toISOString().slice(0, 10)).toBe("2026-12-22");
  });
  it("accepts only Razorpay's real signature", () => {
    const key = "test_secret";
    const sig = createHmac("sha256", key).update("order_1|pay_1").digest("hex");
    expect(verifySignature("order_1", "pay_1", sig, key)).toBe(true);
    expect(verifySignature("order_1", "pay_2", sig, key)).toBe(false);
    expect(verifySignature("order_1", "pay_1", "forged", key)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { balanceOf, computeStatus, daysLate, isOverdue } from "../src/lib/invoice-status";
import { fromKey } from "../src/lib/dates";

describe("invoice status", () => {
  it("computes status from payments", () => {
    expect(computeStatus(2000, 0)).toBe("SENT");
    expect(computeStatus(2000, 500)).toBe("PARTIAL");
    expect(computeStatus(2000, 2000)).toBe("PAID");
    expect(computeStatus(2000, 0, "DRAFT")).toBe("DRAFT");
  });
  it("is overdue only when unpaid and due before today (IST day)", () => {
    const today = fromKey("2026-11-22");
    const inv = { amount: 2000, dueDate: fromKey("2026-11-21"), payments: [{ amount: 500 }] };
    expect(balanceOf(inv)).toBe(1500);
    expect(isOverdue(inv, today)).toBe(true);
    expect(isOverdue({ ...inv, dueDate: today }, today)).toBe(false);
    expect(isOverdue({ ...inv, payments: [{ amount: 2000 }] }, today)).toBe(false);
    expect(daysLate(fromKey("2026-11-10"), today)).toBe(12);
    expect(daysLate(fromKey("2026-11-30"), today)).toBe(0);
  });
});

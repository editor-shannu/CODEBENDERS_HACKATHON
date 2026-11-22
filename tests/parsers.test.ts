import { describe, expect, it } from "vitest";
import { matchInvoices, parseUpiSms } from "../src/lib/upi-sms";
import { parseKhata } from "../src/lib/voice-khata";
import { buildReport } from "../src/lib/report";
import { isPaused } from "../src/lib/invoices";
import { fromKey } from "../src/lib/dates";

const today = fromKey("2026-11-22");

describe("Paste & Match", () => {
  it("parses a bank SMS", () => {
    expect(parseUpiSms("Rs.1,800.00 credited to your A/c XX1234 on 21-11-26 by UPI from ANITHA VASUPALLI. UPI Ref No 432198765432.", today)).toEqual({ amount: 1800, utr: "432198765432", payer: "ANITHA VASUPALLI", vpa: null, date: "2026-11-21" });
    expect(parseUpiSms("You have received Rs 2200 from padma.bonela@okicici on 20 Nov 2026. UTR: 532109876543", today)).toMatchObject({ amount: 2200, vpa: "padma.bonela@okicici", date: "2026-11-20" });
  });
  it("matches the likeliest invoice", () => {
    const open = [
      { invoiceId: "1", familyId: "a", parent: "Anitha Vasupalli", kids: ["Rishi"], balance: 1800, number: "LTP-1", dueDate: "2026-11-10" },
      { invoiceId: "2", familyId: "b", parent: "Padma Rani Bonela", kids: ["Kiran"], balance: 2200, number: "LTP-2", dueDate: "2026-11-05" },
    ];
    expect(matchInvoices(parseUpiSms("Rs 2200 from padma.bonela@okicici UTR 532109876543", today), open)[0].invoiceId).toBe("2");
    expect(matchInvoices({ amount: 1800, utr: null, payer: "ANITHA V", vpa: null, date: null }, open)[0].invoiceId).toBe("1");
  });
});

describe("Voice Khata", () => {
  it("reads spoken payments", () => {
    expect(parseKhata("Ravi paid 1500 cash")).toEqual({ name: "ravi", amount: 1500, mode: "CASH" });
    expect(parseKhata("Anitha paid two thousand five hundred by gpay")).toEqual({ name: "anitha", amount: 2500, mode: "UPI" });
    expect(parseKhata("Padma ichindi 2,200 nagadu")).toEqual({ name: "padma", amount: 2200, mode: "CASH" });
  });
});

describe("Report card and fee pause", () => {
  it("builds the month numbers", () => {
    const r = buildReport(
      [
        { familyId: "a", parent: "A", amount: 2000, dueDate: fromKey("2026-10-05"), payments: [{ amount: 2000, date: fromKey("2026-10-04") }] },
        { familyId: "b", parent: "B", amount: 1000, dueDate: fromKey("2026-10-05"), payments: [{ amount: 400, date: fromKey("2026-10-20") }] },
      ],
      [{ kept: true }, { kept: false }, { kept: null }],
      today,
    );
    expect(r).toMatchObject({ due: 3000, collected: 2400, outstanding: 600, onTime: 1, promisesKept: 1, promisesBroken: 1 });
    expect(r.best[0]).toEqual({ parent: "A", days: -1 });
    expect(r.slowest[0]).toMatchObject({ parent: "B", open: true });
  });
  it("knows paused months", () => {
    expect(isPaused("2026-12,2027-01", "2026-12")).toBe(true);
    expect(isPaused("", "2026-12")).toBe(false);
  });
});

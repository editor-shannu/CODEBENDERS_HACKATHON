import { describe, expect, it } from "vitest";
import { buildCandidates, guessTutor, kidsIn, parseChat } from "../src/lib/whatsapp-import";

const ANDROID = `02/11/26, 7:01 pm - Messages and calls are end-to-end encrypted.
02/11/26, 7:05 pm - Lakshmi Madam: Namaste parents, November fee is due by 5th. Please pay by GPay.
02/11/26, 7:10 pm - Srinivasa Rao: Ok madam. Pranav will come tomorrow
03/11/26, 9:12 am - Srinivasa Rao: Madam fee sent 2200 by phonepe for Pranav fees
03/11/26, 9:20 am - Lakshmi Madam: Received, thank you
04/11/26, 8:00 pm - Padma Rani: Yashwanth mother here. sir next week pakka istanu fee
04/11/26, 8:01 pm - Padma Rani: he is in 8th class
05/11/26, 6:00 pm - +91 98490 12345: <Media omitted>
05/11/26, 6:01 pm - +91 98490 12345: ₹1,500 paid via gpay
madam please check
06/11/26, 6:00 pm - Lakshmi Madam: Reminder: class at 5 pm today`;

const IOS = `[21/11/2026, 20:15:03] Teacher Anitha: Fees due
[21/11/2026, 20:16:10] Rafi: My son Ayaan fee bhej diya 2400 rs
[21/11/2026, 20:17:00] Rafi: class 8`;

describe("WhatsApp import", () => {
  it("parses Android exports, joins continuation lines and drops system lines", () => {
    const msgs = parseChat(ANDROID);
    expect(msgs.length).toBe(8);
    expect(msgs[msgs.length - 2].text).toContain("madam please check");
    expect(msgs[0].at.toISOString().slice(0, 10)).toBe("2026-11-02");
  });

  it("finds the tutor, families, kids, classes, payments and promises", () => {
    const msgs = parseChat(ANDROID);
    const tutor = guessTutor(msgs);
    expect(tutor).toBe("Lakshmi Madam");
    const c = buildCandidates(msgs, tutor);
    const sri = c.find((x) => x.sender === "Srinivasa Rao")!;
    expect(sri.payments).toEqual([expect.objectContaining({ amount: 2200, date: "2026-11-03" })]);
    expect(sri.kids[0].name).toBe("Pranav");
    const padma = c.find((x) => x.sender === "Padma Rani")!;
    expect(padma.kids[0]).toEqual({ name: "Yashwanth", batch: "Class 8" });
    expect(padma.promiseText).toContain("next week");
    expect(padma.language).toBe("te");
    const phone = c.find((x) => x.sender.startsWith("+91"))!;
    expect(phone.parentName).toBe("Parent 2345");
    expect(phone.payments[0].amount).toBe(1500);
  });

  it("parses iOS exports", () => {
    const msgs = parseChat(IOS);
    const c = buildCandidates(msgs, guessTutor(msgs) === "Rafi" ? "Teacher Anitha" : guessTutor(msgs));
    const rafi = c.find((x) => x.sender === "Rafi")!;
    expect(rafi.kids[0]).toEqual({ name: "Ayaan", batch: "Class 8" });
    expect(rafi.payments[0].amount).toBe(2400);
    expect(rafi.language).toBe("hi");
  });

  it("finds children named next to their class, and a parent who introduces themself", () => {
    expect(kidsIn("Madam fee sent 2200 by phonepe for Pranav 8th class")).toContain("Pranav");
    expect(kidsIn("Madam Ishaan 6th class fee 1800 will pay on friday")).toContain("Ishaan");
    expect(kidsIn("Hi madam, I am Meena, Arjun's mother. Arjun 9th class")).toEqual(["Arjun"]);
    const msgs = parseChat("03/11/26, 8:05 pm - +91 98480 12345: Hi madam, I am Meena, Arjun's mother. Arjun 9th class");
    const [c] = buildCandidates(msgs, null);
    expect(c.parentName).toBe("Meena");
    expect(c.kids[0]).toEqual({ name: "Arjun", batch: "Class 9" });
  });
});
